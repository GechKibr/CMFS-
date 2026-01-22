from django.core.management.base import BaseCommand
from accounts.models import User
from complaints.models import Category, CategoryResolver, ResolverLevel, Institution
import random

class Command(BaseCommand):
    help = 'Register officer users for each complaint category'

    def handle(self, *args, **options):
        # Ethiopian names for officers
        officer_names = [
            ('Abebe', 'Tesfaye'), ('Almaz', 'Wolde'), ('Bekele', 'Getachew'), ('Birtukan', 'Mengistu'),
            ('Dawit', 'Tadesse'), ('Desta', 'Bekele'), ('Emebet', 'Alemu'), ('Fasil', 'Kebede'),
            ('Genet', 'Desta'), ('Haile', 'Hailu'), ('Hanna', 'Girma'), ('Kebede', 'Mulugeta'),
            ('Lemlem', 'Gebre'), ('Meron', 'Yohannes'), ('Mulugeta', 'Abebe'), ('Netsanet', 'Lemma'),
            ('Rahel', 'Negash'), ('Samuel', 'Worku'), ('Selamawit', 'Assefa'), ('Tadesse', 'Demissie'),
            ('Tigist', 'Teshome'), ('Wondwossen', 'Mekonnen'), ('Yohannes', 'Ayele'), ('Zara', 'Shiferaw'),
            ('Addisu', 'Tekle'), ('Berhane', 'Berhe'), ('Chaltu', 'Molla'), ('Dereje', 'Fisseha'),
            ('Eyob', 'Asfaw'), ('Firehiwot', 'Berhanu'), ('Girma', 'Chala'), ('Hiwot', 'Dagne'),
            ('Kalkidan', 'Eshetu'), ('Mahlet', 'Fekadu'), ('Natnael', 'Gizaw')
        ]

        # Get all categories
        categories = Category.objects.all().order_by('name')
        
        # Get or create resolver level
        institution = Institution.objects.first()
        if not institution:
            institution = Institution.objects.create(
                name="University of Gondar",
                domain="uog.edu.et"
            )
        
        level1, created = ResolverLevel.objects.get_or_create(
            institution=institution,
            level_order=1,
            defaults={
                "name": "department level",
                "escalation_time": "2 00:00:00"
            }
        )

        officers_created = 0
        assignments_created = 0

        for i, category in enumerate(categories):
            if i < len(officer_names):
                first_name, last_name = officer_names[i]
            else:
                # Fallback if more categories than names
                first_name = f"Officer{i+1}"
                last_name = "Handler"

            # Create category-specific email
            category_short = category.name.lower().replace(' ', '').replace('&', '')[:10]
            email = f"{category_short}.officer@uog.edu.et"
            campus_id = f"OFF{1000 + i}"

            try:
                # Create officer user
                officer = User.objects.create_user(
                    email=email,
                    password='12345678',
                    first_name=first_name,
                    last_name=last_name,
                    role=User.ROLE_OFFICER,
                    campus_id=campus_id,
                    is_active=True,
                    is_email_verified=True
                )
                officers_created += 1
                
                # Assign officer to category
                CategoryResolver.objects.create(
                    category=category,
                    level=level1,
                    officer=officer,
                    active=True
                )
                assignments_created += 1
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Created officer: {officer.full_name} ({email}) -> {category.name}'
                    )
                )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Failed to create officer for {category.name}: {e}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nSummary:\n'
                f'- Officers created: {officers_created}\n'
                f'- Category assignments: {assignments_created}\n'
                f'- Total categories: {categories.count()}'
            )
        )
