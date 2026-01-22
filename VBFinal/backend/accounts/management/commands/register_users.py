from django.core.management.base import BaseCommand
from accounts.models import User
import random

class Command(BaseCommand):
    help = 'Register 35 users with Ethiopian names and category emails'

    def handle(self, *args, **options):
        # Ethiopian names
        first_names = [
            'Abebe', 'Almaz', 'Bekele', 'Birtukan', 'Dawit', 'Desta', 'Emebet', 'Fasil',
            'Genet', 'Haile', 'Hanna', 'Kebede', 'Lemlem', 'Meron', 'Mulugeta', 'Netsanet',
            'Rahel', 'Samuel', 'Selamawit', 'Tadesse', 'Tigist', 'Wondwossen', 'Yohannes',
            'Zara', 'Addisu', 'Berhane', 'Chaltu', 'Dereje', 'Eyob', 'Firehiwot', 'Girma',
            'Hiwot', 'Kalkidan', 'Mahlet', 'Natnael'
        ]
        
        last_names = [
            'Tesfaye', 'Wolde', 'Getachew', 'Mengistu', 'Tadesse', 'Bekele', 'Alemu',
            'Kebede', 'Desta', 'Hailu', 'Girma', 'Mulugeta', 'Gebre', 'Yohannes',
            'Abebe', 'Lemma', 'Negash', 'Worku', 'Assefa', 'Demissie', 'Teshome',
            'Mekonnen', 'Ayele', 'Shiferaw', 'Tekle', 'Berhe', 'Molla', 'Fisseha',
            'Asfaw', 'Berhanu', 'Chala', 'Dagne', 'Eshetu', 'Fekadu', 'Gizaw'
        ]

        colleges = list(User.COLLEGE_CHOICES)
        roles = [User.ROLE_USER, User.ROLE_OFFICER, User.ROLE_ADMIN]
        
        # Email domains by category
        email_domains = {
            'CMHS': 'health.edu.et',
            'CNCS': 'science.edu.et', 
            'CBE': 'business.edu.et',
            'CSSH': 'social.edu.et',
            'CVMAS': 'vet.edu.et',
            'CAES': 'agri.edu.et',
            'COI': 'informatics.edu.et',
            'COE': 'education.edu.et',
            'IOT': 'tech.edu.et',
            'IOB': 'biotech.edu.et',
            'SOL': 'law.edu.et'
        }

        users_created = 0
        
        for i in range(35):
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            college_code, college_name = random.choice(colleges)
            role = random.choice(roles)
            
            # Create email based on college category
            domain = email_domains.get(college_code, 'university.edu.et')
            email = f"{first_name.lower()}.{last_name.lower()}{i+1}@{domain}"
            
            # Generate campus ID
            campus_id = f"{college_code}{1000 + i}"
            
            try:
                user = User.objects.create_user(
                    email=email,
                    password='12345678',
                    first_name=first_name,
                    last_name=last_name,
                    college=college_code,
                    role=role,
                    campus_id=campus_id,
                    is_active=True,
                    is_email_verified=True
                )
                users_created += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created user: {user.full_name} ({email}) - {role}')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Failed to create user {first_name} {last_name}: {e}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {users_created} users')
        )
