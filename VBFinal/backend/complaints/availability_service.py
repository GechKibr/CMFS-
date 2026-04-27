from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from .models import AvailabilityBlock, AvailabilityRule, AppointmentAvailability


class AvailabilityService:
    DEFAULT_RANGE_DAYS = 14

    @staticmethod
    def _as_aware(dt_value):
        if timezone.is_naive(dt_value):
            return timezone.make_aware(dt_value)
        return dt_value

    @classmethod
    def generate_slots_for_officers(cls, officer_ids, start_date, end_date):
        if not officer_ids or not start_date or not end_date:
            return 0

        rules = list(
            AvailabilityRule.objects.filter(
                officer_id__in=officer_ids,
                is_active=True,
            )
        )
        if not rules:
            return 0

        existing_slots = AppointmentAvailability.objects.filter(
            officer_id__in=officer_ids,
            available_date__range=(start_date, end_date),
        ).values_list('officer_id', 'available_date', 'start_time', 'end_time')
        existing_set = set(existing_slots)

        blocks = AvailabilityBlock.objects.filter(
            officer_id__in=officer_ids,
            is_active=True,
            start_datetime__date__lte=end_date,
            end_datetime__date__gte=start_date,
        ).order_by('start_datetime')
        blocks_by_officer = {}
        for block in blocks:
            blocks_by_officer.setdefault(block.officer_id, []).append(block)

        now = timezone.now()
        to_create = []
        current_date = start_date
        while current_date <= end_date:
            weekday = current_date.weekday()
            day_rules = [rule for rule in rules if rule.weekday == weekday]
            for rule in day_rules:
                if rule.slot_duration_minutes <= 0:
                    continue

                day_start = datetime.combine(current_date, rule.start_time)
                day_end = datetime.combine(current_date, rule.end_time)
                if day_end <= day_start:
                    continue

                slot_start = day_start
                slot_delta = timedelta(minutes=rule.slot_duration_minutes)
                while slot_start + slot_delta <= day_end:
                    slot_end = slot_start + slot_delta
                    slot_start_aware = cls._as_aware(slot_start)
                    slot_end_aware = cls._as_aware(slot_end)

                    if slot_end_aware <= now:
                        slot_start = slot_start + slot_delta
                        continue

                    key = (rule.officer_id, current_date, slot_start.time(), slot_end.time())
                    if key in existing_set:
                        slot_start = slot_start + slot_delta
                        continue

                    if cls._is_blocked(rule.officer_id, slot_start_aware, slot_end_aware, blocks_by_officer):
                        slot_start = slot_start + slot_delta
                        continue

                    to_create.append(
                        AppointmentAvailability(
                            officer_id=rule.officer_id,
                            rule=rule,
                            available_date=current_date,
                            start_time=slot_start.time(),
                            end_time=slot_end.time(),
                            is_active=True,
                            source=AppointmentAvailability.SOURCE_RULE,
                            generated_at=now,
                        )
                    )
                    existing_set.add(key)
                    slot_start = slot_start + slot_delta

            current_date = current_date + timedelta(days=1)

        if not to_create:
            return 0

        AppointmentAvailability.objects.bulk_create(to_create, ignore_conflicts=True)
        return len(to_create)

    @staticmethod
    def _is_blocked(officer_id, slot_start, slot_end, blocks_by_officer):
        blocks = blocks_by_officer.get(officer_id, [])
        for block in blocks:
            block_start = AvailabilityService._as_aware(block.start_datetime)
            block_end = AvailabilityService._as_aware(block.end_datetime)
            if block_start < slot_end and block_end > slot_start:
                return True
        return False

    @classmethod
    def ensure_generated_slots(cls, officer_ids, start_date, range_days=None):
        if not start_date:
            return 0
        days = range_days if range_days is not None else cls.DEFAULT_RANGE_DAYS
        end_date = start_date + timedelta(days=days)
        return cls.generate_slots_for_officers(officer_ids, start_date, end_date)

    @classmethod
    def apply_block_to_slots(cls, block):
        start_date = block.start_datetime.date()
        end_date = block.end_datetime.date()
        slots = AppointmentAvailability.objects.filter(
            officer_id=block.officer_id,
            available_date__range=(start_date, end_date),
            is_active=True,
        ).order_by('available_date', 'start_time')

        to_disable = []
        for slot in slots:
            slot_start = cls._as_aware(datetime.combine(slot.available_date, slot.start_time))
            slot_end = cls._as_aware(datetime.combine(slot.available_date, slot.end_time))
            if block.start_datetime < slot_end and block.end_datetime > slot_start:
                to_disable.append(slot.id)

        if to_disable:
            AppointmentAvailability.objects.filter(id__in=to_disable).update(is_active=False)

    @classmethod
    def apply_blocks(cls, officer_id, start_date, end_date):
        blocks = AvailabilityBlock.objects.filter(
            officer_id=officer_id,
            is_active=True,
            start_datetime__date__lte=end_date,
            end_datetime__date__gte=start_date,
        )
        for block in blocks:
            cls.apply_block_to_slots(block)
