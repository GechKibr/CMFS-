from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from complaints.models import Institution, Category, ResolverLevel, CategoryResolver

User = get_user_model()


class Command(BaseCommand):
    help = 'Setup sample data for testing the complaint system'

    def handle(self, *args, **options):
        self.stdout.write('Setting up sample data...')

        # Create institution
        inst, created = Institution.objects.get_or_create(
            domain="example.edu",
            defaults={"name": "University of Example"}
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Created institution: {inst.name}'))
        else:
            self.stdout.write(f'Institution already exists: {inst.name}')

        # Create resolver levels
        level1, created = ResolverLevel.objects.get_or_create(
            institution=inst,
            level_order=1,
            defaults={
                "name": "Department",
                "escalation_time": "2 00:00:00"
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Created level: {level1.name}'))

        level2, created = ResolverLevel.objects.get_or_create(
            institution=inst,
            level_order=2,
            defaults={
                "name": "Dean",
                "escalation_time": "3 00:00:00"
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Created level: {level2.name}'))

        level3, created = ResolverLevel.objects.get_or_create(
            institution=inst,
            level_order=3,
            defaults={
                "name": "President",
                "escalation_time": "5 00:00:00"
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✓ Created level: {level3.name}'))

        # Create categories
        categories_data = [
            {
                "name": "Facilities",
                "description": "Building maintenance, AC, electricity, water, infrastructure issues"
            },
            {
                "name": "Academic",
                "description": "Course registration, grades, exams, curriculum, teaching quality issues"
            },
            {
                "name": "Harassment",
                "description": "Bullying, discrimination, harassment, assault complaints"
            },
            {
                "name": "IT Services",
                "description": "Internet, WiFi, computer lab, software, email access issues"
            },
            {
                "name": "Financial",
                "description": "Tuition, fees, scholarships, refunds, payment issues"
            },
            {
                "name": "Library",
                "description": "Library access, book availability, study space issues"
            }
        ]

        categories = {}
        for cat_data in categories_data:
            cat, created = Category.objects.get_or_create(
                institution=inst,
                name=cat_data["name"],
                defaults={"description": cat_data["description"]}
            )
            categories[cat_data["name"]] = cat
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created category: {cat.name}'))

        # Create officers
        officers_data = [
            {"username": "facilities_officer", "email": "facilities@example.edu", "category": "Facilities"},
            {"username": "academic_officer", "email": "academic@example.edu", "category": "Academic"},
            {"username": "harassment_officer", "email": "harassment@example.edu", "category": "Harassment"},
            {"username": "it_officer", "email": "it@example.edu", "category": "IT Services"},
            {"username": "finance_officer", "email": "finance@example.edu", "category": "Financial"},
            {"username": "library_officer", "email": "library@example.edu", "category": "Library"},
        ]

        for officer_data in officers_data:
            officer, created = User.objects.get_or_create(
                username=officer_data["username"],
                defaults={
                    "email": officer_data["email"],
                    "role": "officer",
                    "institution": inst
                }
            )
            if created:
                officer.set_password("password123")
                officer.save()
                self.stdout.write(self.style.SUCCESS(f'✓ Created officer: {officer.username}'))

            # Assign to category at level 1
            category = categories[officer_data["category"]]
            CategoryResolver.objects.get_or_create(
                category=category,
                level=level1,
                officer=officer,
                defaults={"active": True}
            )

        # Create dean
        dean, created = User.objects.get_or_create(
            username="dean",
            defaults={
                "email": "dean@example.edu",
                "role": "officer",
                "institution": inst
            }
        )
        if created:
            dean.set_password("password123")
            dean.save()
            self.stdout.write(self.style.SUCCESS(f'✓ Created dean: {dean.username}'))

        # Assign dean to all categories at level 2
        for cat in categories.values():
            CategoryResolver.objects.get_or_create(
                category=cat,
                level=level2,
                officer=dean,
                defaults={"active": True}
            )

        # Create students
        for i in range(1, 4):
            student, created = User.objects.get_or_create(
                username=f"student{i}",
                defaults={
                    "email": f"student{i}@example.edu",
                    "role": "student",
                    "institution": inst
                }
            )
            if created:
                student.set_password("password123")
                student.save()
                self.stdout.write(self.style.SUCCESS(f'✓ Created student: {student.username}'))

        # Create admin
        admin, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.edu",
                "role": "admin",
                "institution": inst,
                "is_staff": True,
                "is_superuser": True
            }
        )
        if created:
            admin.set_password("admin123")
            admin.save()
            self.stdout.write(self.style.SUCCESS(f'✓ Created admin: {admin.username}'))

        self.stdout.write(self.style.SUCCESS('\n✅ Setup complete!'))
        self.stdout.write('\nTest accounts:')
        self.stdout.write('  Students: student1, student2, student3 (password: password123)')
        self.stdout.write('  Officers: facilities_officer, academic_officer, etc. (password: password123)')
        self.stdout.write('  Dean: dean (password: password123)')
        self.stdout.write('  Admin: admin (password: admin123)')
