from django.core.mail import send_mail
from django.conf import settings
from .utils import log_email


class EmailService:
    @staticmethod
    def send_email(subject, message, recipient_list, email_type='general', recipient_user=None, html_message=None):
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipient_list,
                html_message=html_message,
                fail_silently=False,
            )
            
            for email in recipient_list:
                log_email(
                    email=email,
                    subject=subject,
                    message=message,
                    email_type=email_type,
                    recipient=recipient_user,
                    status='sent'
                )
            return True
        except Exception as e:
            for email in recipient_list:
                log_email(
                    email=email,
                    subject=subject,
                    message=message,
                    email_type=email_type,
                    recipient=recipient_user,
                    status='failed',
                    error_message=str(e)
                )
            return False

    @staticmethod
    def send_verification_email(user, token):
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        verify_url = f"{frontend_url}/verify-email?token={token.token}"
        
        subject = "Verify Your Email"
        message = f"Click the link to verify your email: {verify_url}"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[user.email],
            email_type='verification',
            recipient_user=user
        )

    @staticmethod
    def send_password_reset_email(user, token):
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        reset_url = f"{frontend_url}/reset-password?token={token.token}"
        destination = getattr(user, 'preferred_notification_email', None) or user.email
        
        subject = "Reset Your Password"
        message = f"Click the link to reset your password: {reset_url}"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[destination],
            email_type='password_reset',
            recipient_user=user
        )

    @staticmethod
    def send_complaint_notification(user, complaint):
        subject = f"Complaint Update: {complaint.title}"
        message = f"Your complaint (ID: {complaint.complaint_id}) status: {complaint.status}"
        destination = getattr(user, 'preferred_notification_email', None) or user.email
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[destination],
            email_type='complaint_notification',
            recipient_user=user
        )

    @staticmethod
    def send_assignment_notification(officer, complaint):
        subject = f"New Complaint Assigned: {complaint.title}"
        message = f"You have been assigned complaint ID: {complaint.complaint_id}"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[officer.email],
            email_type='assignment_notification',
            recipient_user=officer
        )

    @staticmethod
    def send_escalation_alert(officer, complaint):
        subject = f"Complaint Escalated: {complaint.title}"
        message = f"Complaint ID {complaint.complaint_id} has been escalated to your level"
        
        return EmailService.send_email(
            subject=subject,
            message=message,
            recipient_list=[officer.email],
            email_type='escalation_alert',
            recipient_user=officer
        )
