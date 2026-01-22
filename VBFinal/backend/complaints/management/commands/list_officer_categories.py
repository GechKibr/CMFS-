from django.core.management.base import BaseCommand
from complaints.models import Category, CategoryResolver
from accounts.models import User

class Command(BaseCommand):
    help = 'Display all 35 complaint categories for officers in the system'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write(self.style.SUCCESS('COMPLAINT MANAGEMENT SYSTEM - OFFICER CATEGORIES'))
        self.stdout.write(self.style.SUCCESS('=' * 80))
        
        # Get all categories
        categories = Category.objects.all().order_by('name')
        
        self.stdout.write(f'\nTotal Categories Available: {categories.count()}')
        self.stdout.write('-' * 80)
        
        for i, category in enumerate(categories, 1):
            self.stdout.write(f'\n{i:2d}. Category ID: {category.category_id}')
            self.stdout.write(f'    Name: {category.name}')
            self.stdout.write(f'    Description: {category.description}')
            
            # Show assigned officers for this category
            resolvers = CategoryResolver.objects.filter(
                category=category, 
                active=True
            ).select_related('officer', 'level')
            
            if resolvers.exists():
                self.stdout.write('    Assigned Officers:')
                for resolver in resolvers:
                    self.stdout.write(
                        f'      - {resolver.officer.full_name} '
                        f'(Level {resolver.level.level_order}: {resolver.level.name})'
                    )
            else:
                self.stdout.write('    Assigned Officers: None')
        
        # Summary of officers
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write('OFFICER SUMMARY')
        self.stdout.write('=' * 80)
        
        officers = User.objects.filter(role=User.ROLE_OFFICER)
        self.stdout.write(f'\nTotal Officers in System: {officers.count()}')
        
        for officer in officers:
            assigned_categories = CategoryResolver.objects.filter(
                officer=officer, 
                active=True
            ).count()
            
            self.stdout.write(
                f'- {officer.full_name} ({officer.email}): '
                f'{assigned_categories} categories assigned'
            )
        
        # Category assignment statistics
        unassigned_categories = Category.objects.filter(
            resolvers__isnull=True
        ).count()
        
        self.stdout.write(f'\nCategories without officers: {unassigned_categories}')
        self.stdout.write(f'Categories with officers: {categories.count() - unassigned_categories}')
        
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('END OF REPORT'))
        self.stdout.write('=' * 80)
