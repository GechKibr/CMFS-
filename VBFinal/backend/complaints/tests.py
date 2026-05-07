from datetime import timedelta

from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Department, Officer, Student, User
from complaints.models import Appointment, Category, CategoryResolver, Comment, Complaint, ComplaintCC, Response


class ComplaintSecurityAPITests(APITestCase):
    def setUp(self):
        self.admin = self._create_user('admin@example.com', role=User.ROLE_ADMIN)
        self.user_one = self._create_user('user-one@example.com', role=User.ROLE_USER)
        self.user_two = self._create_user('user-two@example.com', role=User.ROLE_USER)
        self.officer_one = self._create_user('officer-one@example.com', role=User.ROLE_OFFICER)
        self.officer_two = self._create_user('officer-two@example.com', role=User.ROLE_OFFICER)

        Officer.objects.create(user=self.officer_one, employee_id='EMP-001')
        Officer.objects.create(user=self.officer_two, employee_id='EMP-002')

        self.category = Category.objects.create(
            office_name='General Support',
            office_description='General complaint routing',
        )
        CategoryResolver.objects.create(
            category=self.category,
            campus=None,
            college=None,
            department=None,
            officer=self.officer_one,
            escalation_time=timedelta(hours=1),
        )

        self.assigned_complaint = Complaint.objects.create(
            submitted_by=self.user_one,
            category=self.category,
            title='Assigned complaint',
            description='Assigned complaint description',
            assigned_officer=self.officer_one,
        )
        self.officer_visible_complaint = Complaint.objects.create(
            submitted_by=self.officer_one,
            category=self.category,
            title='Officer complaint',
            description='Officer submitted complaint',
            assigned_officer=self.officer_two,
        )
        self.hidden_complaint = Complaint.objects.create(
            submitted_by=self.user_two,
            category=self.category,
            title='Hidden complaint',
            description='Complaint not visible to officer one',
            assigned_officer=self.officer_two,
        )
        ComplaintCC.objects.create(complaint=self.hidden_complaint, email=self.user_one.email)

    def _create_user(self, email, role=User.ROLE_USER, password='Password123!'):
        return User.objects.create_user(
            email=email,
            password=password,
            first_name='Test',
            last_name='User',
            role=role,
        )

    def test_complaint_creation_ignores_spoofed_submitter(self):
        self.client.force_authenticate(user=self.user_one)

        response = self.client.post(
            reverse('complaint-list'),
            {
                'title': 'Spoof attempt',
                'description': 'Trying to spoof another submitter',
                'category': self.category.pk,
                'user': self.user_two.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = Complaint.objects.get(title='Spoof attempt')
        self.assertEqual(created.submitted_by, self.user_one)

    def test_complaint_creation_supports_cc_office_selections(self):
        self.client.force_authenticate(user=self.user_one)

        response = self.client.post(
            reverse('complaint-list'),
            {
                'title': 'CC office complaint',
                'description': 'Complaint with backend office CC selection',
                'category': self.category.pk,
                'cc_office_ids': [self.category.pk],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = Complaint.objects.get(title='CC office complaint')
        cc_emails = list(created.cc_list.values_list('email', flat=True))
        self.assertIn(self.officer_one.email, cc_emails)

    def test_public_dashboard_stats_endpoint_returns_summary(self):
        Appointment.objects.create(
            requested_by=self.user_one,
            officer=self.officer_one,
            description='Landing page stats appointment',
            status='pending',
        )

        response = self.client.get(reverse('complaint-public-stats'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('summary', response.data)
        self.assertIn('daily_trend', response.data)
        self.assertIn('recent_activity', response.data)
        self.assertGreaterEqual(response.data['summary']['total_complaints'], 3)

    def test_complaint_creation_filters_cc_office_resolvers_by_scope(self):
        department_one = Department.objects.create(
            department_name='Business Operations',
            department_college='business_economics',
        )
        department_two = Department.objects.create(
            department_name='Accounting',
            department_college='business_economics',
        )
        Student.objects.create(
            user=self.user_one,
            student_type='undergraduate',
            campus_id='maraki',
            department=department_one,
            year_of_study=2,
        )

        CategoryResolver.objects.create(
            category=self.category,
            campus=None,
            college=None,
            department=department_one,
            officer=self.officer_one,
            escalation_time=timedelta(hours=1),
        )
        CategoryResolver.objects.create(
            category=self.category,
            campus=None,
            college=None,
            department=department_two,
            officer=self.officer_two,
            escalation_time=timedelta(hours=1),
        )

        self.client.force_authenticate(user=self.user_one)
        response = self.client.post(
            reverse('complaint-list'),
            {
                'title': 'Scoped CC office complaint',
                'description': 'Complaint with scope-aware CC office selection',
                'category': self.category.pk,
                'cc_office_ids': [self.category.pk],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = Complaint.objects.get(title='Scoped CC office complaint')
        cc_emails = set(created.cc_list.values_list('email', flat=True))
        self.assertSetEqual(cc_emails, {self.officer_one.email})

    def test_complaint_routed_to_all_matching_resolvers_for_same_scope(self):
        department = Department.objects.create(
            department_name='Business Operations',
            department_college='business_economics',
        )
        Student.objects.create(
            user=self.user_one,
            student_type='undergraduate',
            campus_id='maraki',
            department=department,
            year_of_study=2,
        )
        resolver_one = CategoryResolver.objects.create(
            category=self.category,
            campus=None,
            college=None,
            department=department,
            officer=self.officer_one,
            escalation_time=timedelta(hours=1),
        )
        resolver_two = CategoryResolver.objects.create(
            category=self.category,
            campus=None,
            college=None,
            department=department,
            officer=self.officer_two,
            escalation_time=timedelta(hours=1),
        )

        self.client.force_authenticate(user=self.user_one)
        response = self.client.post(
            reverse('complaint-list'),
            {
                'title': 'Department scoped complaint',
                'description': 'Complaint for all department resolvers',
                'category': self.category.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        complaint = Complaint.objects.get(title='Department scoped complaint')
        assignments = complaint.assignments.all()
        self.assertEqual(assignments.count(), 2)
        self.assertIsNone(complaint.assigned_officer)
        self.assertEqual(complaint.current_resolver.department, department)
        self.assertSetEqual(
            set(assignments.values_list('resolver_id', flat=True)),
            {resolver_one.id, resolver_two.id},
        )

    def test_admin_can_bulk_assign_multiple_officers_to_category(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse('resolver-assignment-bulk-create'),
            {
                'category': self.category.pk,
                'escalation_time': '1 00:00:00',
                'active': True,
                'officer_ids': [self.officer_one.id, self.officer_two.id],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['count'], 2)

        assignments = CategoryResolver.objects.filter(
            category=self.category,
            officer__in=[self.officer_one, self.officer_two],
        )
        self.assertEqual(assignments.count(), 2)

    def test_complaint_list_scoping_for_admin_officer_user_and_cc(self):
        self.client.force_authenticate(user=self.admin)
        admin_response = self.client.get(reverse('complaint-list'))
        admin_ids = {item['complaint_id'] for item in admin_response.data['results']}
        self.assertSetEqual(
            admin_ids,
            {
                str(self.assigned_complaint.pk),
                str(self.officer_visible_complaint.pk),
                str(self.hidden_complaint.pk),
            },
        )

        self.client.force_authenticate(user=self.officer_one)
        officer_response = self.client.get(reverse('complaint-list'))
        officer_ids = {item['complaint_id'] for item in officer_response.data['results']}
        self.assertSetEqual(
            officer_ids,
            {
                str(self.assigned_complaint.pk),
                str(self.officer_visible_complaint.pk),
                str(self.hidden_complaint.pk),
            },
        )

        self.client.force_authenticate(user=self.user_one)
        user_response = self.client.get(reverse('complaint-list'))
        user_ids = {item['complaint_id'] for item in user_response.data['results']}
        self.assertSetEqual(user_ids, {str(self.assigned_complaint.pk)})

        cc_response = self.client.get(reverse('complaint-cc-complaints'))
        cc_ids = {item['complaint_id'] for item in cc_response.data}
        self.assertSetEqual(cc_ids, {str(self.hidden_complaint.pk)})

    def test_complaint_action_permissions_and_response_comment_rules(self):
        self.client.force_authenticate(user=self.officer_two)
        forbidden_status_change = self.client.post(
            reverse('complaint-change-status', args=[self.assigned_complaint.pk]),
            {'status': 'resolved'},
            format='json',
        )
        self.assertEqual(forbidden_status_change.status_code, 403)

        self.client.force_authenticate(user=self.officer_one)
        allowed_status_change = self.client.post(
            reverse('complaint-change-status', args=[self.assigned_complaint.pk]),
            {'status': 'resolved'},
            format='json',
        )
        self.assertEqual(allowed_status_change.status_code, 200)
        self.assigned_complaint.refresh_from_db()
        self.assertEqual(self.assigned_complaint.status, 'resolved')

        self.client.force_authenticate(user=self.user_one)
        forbidden_response = self.client.post(
            reverse('response-list'),
            {
                'complaint': str(self.assigned_complaint.pk),
                'title': 'User response',
                'message': 'I should not be able to respond',
                'response_type': 'update',
            },
            format='json',
        )
        self.assertEqual(forbidden_response.status_code, 403)

        self.client.force_authenticate(user=self.officer_one)
        response_create = self.client.post(
            reverse('response-list'),
            {
                'complaint': str(self.assigned_complaint.pk),
                'title': 'Officer response',
                'message': 'We are investigating this issue.',
                'response_type': 'update',
            },
            format='json',
        )
        self.assertEqual(response_create.status_code, 201)
        created_response = Response.objects.get(pk=response_create.data['id'])
        self.assertEqual(created_response.responder, self.officer_one)

        self.client.force_authenticate(user=self.user_one)
        comment_create = self.client.post(
            reverse('comment-list'),
            {
                'complaint': str(self.assigned_complaint.pk),
                'comment_type': 'comment',
                'message': 'Thanks for the update.',
                'author': self.user_two.id,
            },
            format='json',
        )
        self.assertEqual(comment_create.status_code, 201)
        created_comment = Comment.objects.get(pk=comment_create.data['id'])
        self.assertEqual(created_comment.author, self.user_one)

    def test_admin_can_reassign_complaint_without_current_resolver(self):
        CategoryResolver.objects.create(
            category=self.category,
            campus=None,
            college=None,
            department=None,
            officer=self.officer_two,
            escalation_time=timedelta(hours=1),
        )
        complaint = Complaint.objects.create(
            submitted_by=self.user_two,
            category=self.category,
            title='Unrouted complaint',
            description='Complaint without a current level',
            assigned_officer=self.officer_one,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            reverse('complaint-reassign', args=[complaint.pk]),
            {
                'officer_id': self.officer_two.id,
                'reason': 'Escalated',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_officer, self.officer_two)
        self.assertEqual(complaint.current_resolver.officer, self.officer_two)

    def test_admin_analytics_includes_dashboard_statistics(self):
        Appointment.objects.create(
            requested_by=self.user_one,
            officer=self.officer_one,
            description='Dashboard stats appointment',
            status='pending',
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('complaint-analytics'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('admin_dashboard', response.data)
        self.assertIsNotNone(response.data['admin_dashboard'])
        self.assertIn('summary', response.data['admin_dashboard'])
        self.assertIn('status_distribution', response.data['admin_dashboard'])
        self.assertIn('college_performance', response.data['admin_dashboard'])
        self.assertIn('staff_performance', response.data['admin_dashboard'])
