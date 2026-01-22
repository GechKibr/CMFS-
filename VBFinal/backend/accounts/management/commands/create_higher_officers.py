from django.core.management.base import BaseCommand
from accounts.models import User
from complaints.models import Category, CategoryResolver, ResolverLevel, Institution

class Command(BaseCommand):
    help = 'Create higher level officers for escalation'

    def handle(self, *args, **options):
        # Get institution and levels
        institution = Institution.objects.first()
        level2 = ResolverLevel.objects.get(level_order=2)  # Dean
        level3 = ResolverLevel.objects.get(level_order=3)  # President
        
        # Create Dean officers for each category
        categories = Category.objects.all()
        
        # Dean level officers (Level 2)
        dean_names = [
            ('Dr. Alemayehu', 'Teshome'), ('Dr. Birtukan', 'Adane'), ('Dr. Chala', 'Merga'),
            ('Dr. Desta', 'Worku'), ('Dr. Emebet', 'Kebede'), ('Dr. Fasil', 'Getnet'),
            ('Dr. Genet', 'Tadesse'), ('Dr. Haile', 'Mariam'), ('Dr. Kalkidan', 'Belay')
        ]
        
        # President level officers (Level 3) 
        president_names = [
            ('Prof. Abebe', 'Demissie'), ('Prof. Birtukan', 'Negash'), ('Prof. Chala', 'Bekele')
        ]
        
        dean_count = 0
        president_count = 0
        
        # Create dean officers and assign to categories
        for i, category in enumerate(categories):
            if i < len(dean_names):
                first_name, last_name = dean_names[i % len(dean_names)]
                
                # Create dean officer
                dean_email = f"{first_name.lower().replace('dr. ', '')}.{last_name.lower()}@dean.uog.edu.et"
                dean, created = User.objects.get_or_create(
                    email=dean_email,
                    defaults={
                        'first_name': first_name,
                        'last_name': last_name,
                        'role': User.ROLE_OFFICER,
                        'campus_id': f'DEAN{1000 + i}',
                        'is_active': True,
                        'is_email_verified': True
                    }
                )
                
                if created:
                    dean.set_password('12345678')
                    dean.save()
                    dean_count += 1
                
                # Assign dean to category at level 2
                CategoryResolver.objects.get_or_create(
                    category=category,
                    level=level2,
                    officer=dean,
                    defaults={'active': True}
                )
                
                # Create president officer for every 12 categories
                if i % 12 == 0 and i // 12 < len(president_names):
                    first_name_p, last_name_p = president_names[i // 12]
                    
                    president_email = f"{first_name_p.lower().replace('prof. ', '')}.{last_name_p.lower()}@president.uog.edu.et"
                    president, created = User.objects.get_or_create(
                        email=president_email,
                        defaults={
                            'first_name': first_name_p,
                            'last_name': last_name_p,
                            'role': User.ROLE_OFFICER,
                            'campus_id': f'PRES{2000 + (i // 12)}',
                            'is_active': True,
                            'is_email_verified': True
                        }
                    )
                    
                    if created:
                        president.set_password('12345678')
                        president.save()
                        president_count += 1
                
                # Assign president to multiple categories
                president_idx = min(i // 12, len(president_names) - 1)
                if president_idx < len(president_names):
                    first_name_p, last_name_p = president_names[president_idx]
                    president_email = f"{first_name_p.lower().replace('prof. ', '')}.{last_name_p.lower()}@president.uog.edu.et"
                    
                    try:
                        president = User.objects.get(email=president_email)
                        CategoryResolver.objects.get_or_create(
                            category=category,
                            level=level3,
                            officer=president,
                            defaults={'active': True}
                        )
                    except User.DoesNotExist:
                        pass
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Created {dean_count} dean officers and {president_count} president officers'
            )
        )
        
        # Show summary
        self.stdout.write('\n=== ESCALATION HIERARCHY CREATED ===')
        for level in [level2, level3]:
            resolvers = CategoryResolver.objects.filter(level=level, active=True)
            self.stdout.write(f'Level {level.level_order} ({level.name}): {resolvers.count()} assignments')
