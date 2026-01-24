from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from feedback.models import FeedbackTemplate, TemplateField

User = get_user_model()

class Command(BaseCommand):
    help = 'Create sample feedback templates for testing'

    def handle(self, *args, **options):
        # Create or get an officer user
        officer, created = User.objects.get_or_create(
            email='officer@example.com',
            defaults={
                'first_name': 'Test',
                'last_name': 'Officer',
                'role': User.ROLE_OFFICER,
                'college': 'COI',
                'is_active': True
            }
        )
        
        if created:
            officer.set_password('testpass123')
            officer.save()
            self.stdout.write(f'Created officer user: {officer.email}')
        
        # Create sample template
        template, created = FeedbackTemplate.objects.get_or_create(
            title='Course Evaluation Form',
            defaults={
                'description': 'Please provide feedback about your course experience',
                'created_by': officer,
                'office': officer.college,
                'status': FeedbackTemplate.STATUS_ACTIVE
            }
        )
        
        if created:
            # Create fields for the template
            fields_data = [
                {
                    'label': 'How would you rate this course overall?',
                    'field_type': TemplateField.FIELD_RATING,
                    'is_required': True,
                    'order': 0
                },
                {
                    'label': 'What did you like most about the course?',
                    'field_type': TemplateField.FIELD_TEXT,
                    'is_required': False,
                    'order': 1
                },
                {
                    'label': 'Which topics were most useful?',
                    'field_type': TemplateField.FIELD_CHECKBOX,
                    'is_required': False,
                    'order': 2,
                    'options': ['Lectures', 'Lab Sessions', 'Assignments', 'Group Projects']
                },
                {
                    'label': 'How likely are you to recommend this course?',
                    'field_type': TemplateField.FIELD_CHOICE,
                    'is_required': True,
                    'order': 3,
                    'options': ['Very Likely', 'Likely', 'Neutral', 'Unlikely', 'Very Unlikely']
                },
                {
                    'label': 'Rate the instructor effectiveness (1-10)',
                    'field_type': TemplateField.FIELD_NUMBER,
                    'is_required': False,
                    'order': 4
                }
            ]
            
            for field_data in fields_data:
                TemplateField.objects.create(template=template, **field_data)
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created template: {template.title}')
            )
        else:
            self.stdout.write(f'Template already exists: {template.title}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Sample data created. Officer login: {officer.email} / testpass123'
            )
        )
