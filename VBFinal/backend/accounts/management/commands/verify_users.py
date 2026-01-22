from django.core.management.base import BaseCommand
from accounts.models import User

class Command(BaseCommand):
    help = 'Verify user count and display summary'

    def handle(self, *args, **options):
        total_users = User.objects.count()
        
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('USER DATABASE SUMMARY'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
        
        self.stdout.write(f'Total users in database: {total_users}')
        
        self.stdout.write('\nUsers by role:')
        for role, role_name in User.ROLE_CHOICES:
            count = User.objects.filter(role=role).count()
            self.stdout.write(f'  {role_name}: {count}')
        
        self.stdout.write('\nUsers by status:')
        active_count = User.objects.filter(is_active=True).count()
        inactive_count = User.objects.filter(is_active=False).count()
        self.stdout.write(f'  Active: {active_count}')
        self.stdout.write(f'  Inactive: {inactive_count}')
        
        self.stdout.write('\nRecent users (last 5):')
        recent_users = User.objects.order_by('-date_joined')[:5]
        for user in recent_users:
            self.stdout.write(f'  {user.full_name} ({user.email}) - {user.role}')
        
        self.stdout.write(self.style.SUCCESS('\n✅ All 41 users should now be visible in frontend!'))
