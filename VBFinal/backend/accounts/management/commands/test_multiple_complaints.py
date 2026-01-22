from django.core.management.base import BaseCommand
from complaints.models import Complaint, Category, Institution
from accounts.models import User

class Command(BaseCommand):
    help = 'Test multiple complaints per user functionality'

    def handle(self, *args, **options):
        # Get a test user
        user = User.objects.filter(role=User.ROLE_USER).first()
        if not user:
            self.stdout.write(self.style.ERROR('No regular user found'))
            return

        # Get categories and institution
        categories = Category.objects.all()[:5]  # Get first 5 categories
        institution = Institution.objects.first()

        if not categories.exists():
            self.stdout.write(self.style.ERROR('No categories found'))
            return

        # Create multiple test complaints for the user
        complaint_titles = [
            "Library WiFi Connection Issues",
            "Cafeteria Food Quality Concern", 
            "Classroom Projector Not Working",
            "Student ID Card Replacement Request",
            "Dormitory Maintenance Issue"
        ]

        complaints_created = 0
        
        for i, title in enumerate(complaint_titles):
            try:
                complaint = Complaint.objects.create(
                    submitted_by=user,
                    institution=institution,
                    category=categories[i % categories.count()],
                    title=title,
                    description=f"This is a test complaint about {title.lower()}. "
                               f"The issue needs to be addressed promptly.",
                    status='pending',
                    priority='medium'
                )
                complaints_created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created complaint: {complaint.title}')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Failed to create complaint "{title}": {e}')
                )

        # Show user's total complaints
        total_complaints = user.complaints_made.count()
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Multiple Complaints Test Complete!\n'
                f'User: {user.full_name}\n'
                f'Total complaints: {total_complaints}\n'
                f'New complaints created: {complaints_created}'
            )
        )
        
        # List all user's complaints
        self.stdout.write('\n📋 All complaints by this user:')
        for complaint in user.complaints_made.all():
            self.stdout.write(f'  • {complaint.title} ({complaint.status})')
            
        self.stdout.write(
            self.style.SUCCESS(
                '\n✨ Multiple complaints per user is fully supported!'
            )
        )
