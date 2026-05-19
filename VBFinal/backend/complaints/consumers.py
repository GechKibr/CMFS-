from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.exceptions import PermissionDenied
from django.db.models import F, Q

from accounts.models import User

from .models import Comment, Complaint, Response
from .realtime import (
    analytics_group_name,
    build_complaint_analytics,
    build_thread_snapshot,
    complaint_thread_group_name,
    serialize_comment,
    serialize_response,
)


def _user_can_access_complaint(user, complaint):
    if not user or not user.is_authenticated or not complaint:
        return False
    if user.is_admin():
        return True
    if complaint.submitted_by_id == user.id:
        return True
    if complaint.claimed_by_id == user.id:
        return True
    if complaint.current_resolver_id and complaint.current_resolver.officers.filter(
        officer_id=user.id,
        active=True,
        officer__is_active=True,
    ).exists():
        return True
    if complaint.category_id:
        resolver_scope_q = (
            (Q(category__resolvers__campus__isnull=True) | Q(category__resolvers__campus=F('campus')))
            & (Q(category__resolvers__college__isnull=True) | Q(category__resolvers__college=F('college')))
            & (Q(category__resolvers__department__isnull=True) | Q(category__resolvers__department=F('department')))
        )

        return CategoryResolver.objects.filter(
            category=complaint.category,
            active=True,
            officers__officer=user,
            officers__active=True,
            officers__officer__is_active=True,
        ).filter(resolver_scope_q).exists()

    return False


@database_sync_to_async
def _get_complaint_for_user(user, complaint_id):
    if not user or not user.is_authenticated:
        return None

    queryset = Complaint.objects.filter(complaint_id=complaint_id)
    if user.is_admin():
        return queryset.first()
    if user.is_officer():
        resolver_scope_q = (
            (Q(category__resolvers__campus__isnull=True) | Q(category__resolvers__campus=F('campus')))
            & (Q(category__resolvers__college__isnull=True) | Q(category__resolvers__college=F('college')))
            & (Q(category__resolvers__department__isnull=True) | Q(category__resolvers__department=F('department')))
        )

        return queryset.filter(
            Q(submitted_by=user)
            | Q(claimed_by=user)
            | Q(current_resolver__officers__officer=user, current_resolver__officers__active=True, current_resolver__officers__officer__is_active=True)
            | (
                Q(
                    category__resolvers__officers__officer=user,
                    category__resolvers__active=True,
                    category__resolvers__officers__active=True,
                    category__resolvers__officers__officer__is_active=True,
                )
                & resolver_scope_q
            )
        ).distinct().first()
    return queryset.filter(submitted_by=user).first()


@database_sync_to_async
def _create_comment(user, complaint_id, message):
    complaint = Complaint.objects.get(complaint_id=complaint_id)
    if complaint.submitted_by_id == user.id:
        if not Response.objects.filter(complaint=complaint).exists():
            raise PermissionDenied('You can add a comment only after an officer responds to your complaint.')

    if not (user.is_admin() or user.is_officer() or complaint.submitted_by_id == user.id):
        raise PermissionDenied('You do not have access to this complaint.')

    comment = Comment.objects.create(
        complaint=complaint,
        author=user,
        message=message,
        comment_type='comment',
    )
    return serialize_comment(comment)


@database_sync_to_async
def _create_response(user, complaint_id, title, message, response_type='update'):
    if not (user.is_admin() or user.is_officer()):
        raise PermissionDenied('Only officers and admins can respond to complaints.')

    complaint = Complaint.objects.get(complaint_id=complaint_id)
    if not _user_can_access_complaint(user, complaint):
        raise PermissionDenied('You do not have access to this complaint.')

    response = Response.objects.create(
        complaint=complaint,
        responder=user,
        title=title or 'Officer Response',
        message=message,
        response_type=response_type or 'update',
        is_public=True,
    )
    return serialize_response(response)


class ComplaintThreadConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        self.complaint_id = self.scope['url_route']['kwargs']['complaint_id']
        self.group_name = complaint_thread_group_name(self.complaint_id)

        complaint = await _get_complaint_for_user(self.user, self.complaint_id)
        if not complaint:
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        snapshot = await database_sync_to_async(build_thread_snapshot)(complaint)
        await self.send_json({
            'type': 'thread.snapshot',
            **snapshot,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get('type')
        if message_type != 'chat.message':
            await self.send_json({'type': 'error', 'message': 'Unsupported message type'})
            return

        kind = content.get('kind')
        message = (content.get('message') or '').strip()
        if not message:
            await self.send_json({'type': 'error', 'message': 'Message cannot be empty'})
            return

        if kind == 'comment':
            try:
                comment_data = await _create_comment(self.user, self.complaint_id, message)
                await self.send_json({'type': 'chat.created', 'kind': 'comment', 'item': comment_data})
            except Exception as exc:
                await self.send_json({'type': 'error', 'message': str(exc)})
            return

        if kind == 'response':
            try:
                response_data = await _create_response(
                    self.user,
                    self.complaint_id,
                    content.get('title') or 'Officer Response',
                    message,
                    content.get('response_type') or 'update',
                )
                await self.send_json({'type': 'chat.created', 'kind': 'response', 'item': response_data})
            except Exception as exc:
                await self.send_json({'type': 'error', 'message': str(exc)})
            return

        await self.send_json({'type': 'error', 'message': 'Unsupported chat kind'})

    async def broadcast_event(self, event):
        await self.send_json({
            'type': event.get('event_type'),
            **event.get('payload', {}),
        })


class AnalyticsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated or not (self.user.is_admin() or self.user.is_officer()):
            await self.close(code=4403)
            return

        scope = 'admin' if self.user.is_admin() else 'officer'
        self.group_name = analytics_group_name(scope, self.user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'analytics.snapshot',
            'summary': await build_analytics_snapshot_async(self.user),
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def broadcast_event(self, event):
        await self.send_json({
            'type': event.get('event_type'),
            **event.get('payload', {}),
        })


@database_sync_to_async
def build_analytics_snapshot_async(user):
    return build_complaint_analytics(user)
