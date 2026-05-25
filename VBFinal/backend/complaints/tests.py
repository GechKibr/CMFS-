from datetime import timedelta

from django.utils import timezone

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Department, Officer, User
from complaints.escalation_service import EscalationService
from complaints.views import accessible_complaints_for
from complaints.models import Category, CategoryResolver, Complaint, ResolverOfficer, Response


class ComplaintStatusWorkflowTests(TestCase):
	def setUp(self):
		self.officer = User.objects.create_user(
			email='officer@example.com',
			password='12345678',
			first_name='Test',
			last_name='Officer',
			role=User.ROLE_OFFICER,
		)
		Officer.objects.create(user=self.officer, employee_id='EMP-001')

		self.user = User.objects.create_user(
			email='user@example.com',
			password='12345678',
			first_name='Test',
			last_name='User',
			role=User.ROLE_USER,
		)

		self.category = Category.objects.create(
			name='General Support',
			description='General complaint routing',
		)
		self.resolver = CategoryResolver.objects.create(
			category=self.category,
			escalation_time=timedelta(hours=1),
		)
		ResolverOfficer.objects.create(resolver=self.resolver, officer=self.officer)

		self.complaint = Complaint.objects.create(
			submitted_by=self.user,
			category=self.category,
			title='Complaint lifecycle test',
			description='Complaint used to verify status transitions',
			current_resolver=self.resolver,
		)

	def test_status_choices_are_limited_to_the_supported_workflow(self):
		self.assertEqual(
			[value for value, _ in Complaint.STATUS_CHOICES],
			['pending', 'in_progress', 'escalated', 'resolved', 'closed'],
		)

	def test_claim_moves_complaint_into_in_progress(self):
		self.complaint.claim(self.officer)
		self.complaint.refresh_from_db()

		self.assertEqual(self.complaint.status, Complaint.STATUS_IN_PROGRESS)
		self.assertEqual(self.complaint.assigned_officer, self.officer)

	def test_reject_closes_complaint_without_introducing_a_new_status(self):
		self.complaint.reject(actor=self.officer)
		self.complaint.refresh_from_db()

		self.assertEqual(self.complaint.status, Complaint.STATUS_CLOSED)


class ComplaintVisibilityScopeTests(TestCase):
	def setUp(self):
		self.officer = User.objects.create_user(
			email='scope-officer@example.com',
			password='12345678',
			first_name='Scope',
			last_name='Officer',
			role=User.ROLE_OFFICER,
		)
		Officer.objects.create(user=self.officer, employee_id='EMP-002')

		self.user = User.objects.create_user(
			email='scope-user@example.com',
			password='12345678',
			first_name='Scope',
			last_name='User',
			role=User.ROLE_USER,
		)

		self.category = Category.objects.create(
			name='Campus Services',
			description='Scoped complaint routing',
		)
		self.department = Department.objects.create(
			department_name='IT Support',
			department_college='business_economics',
		)
		self.resolver = CategoryResolver.objects.create(
			category=self.category,
			campus='maraki',
			college='business_economics',
			department=self.department,
			escalation_time=timedelta(hours=1),
		)
		ResolverOfficer.objects.create(resolver=self.resolver, officer=self.officer)

		self.matching_complaint = Complaint.objects.create(
			submitted_by=self.user,
			category=self.category,
			campus='maraki',
			college='business_economics',
			department=self.department,
			title='Matching complaint',
			description='Matches the resolver scope',
		)
		self.mismatched_complaint = Complaint.objects.create(
			submitted_by=self.user,
			category=self.category,
			campus='atse_fasil',
			college='business_economics',
			department=self.department,
			title='Mismatched complaint',
			description='Same category but different campus',
		)

	def test_officer_only_sees_complaints_that_match_resolver_scope(self):
		visible_ids = set(accessible_complaints_for(self.officer).values_list('complaint_id', flat=True))

		self.assertIn(self.matching_complaint.complaint_id, visible_ids)
		self.assertNotIn(self.mismatched_complaint.complaint_id, visible_ids)

	def test_assigned_complaints_endpoint_returns_scoped_matches(self):
		client = APIClient()
		client.force_authenticate(user=self.officer)

		response = client.get('/api/complaints/assigned-complaints/')

		self.assertEqual(response.status_code, 200)
		returned_ids = {item['complaint_id'] for item in response.data['results']}
		self.assertIn(str(self.matching_complaint.complaint_id), returned_ids)
		self.assertNotIn(str(self.mismatched_complaint.complaint_id), returned_ids)


class CategoryResolverAPITests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			email='api-user@example.com',
			password='12345678',
			first_name='API',
			last_name='User',
			role=User.ROLE_USER,
		)
		self.category = Category.objects.create(
			name='Scoped Routing',
			description='Category resolver API tests',
		)
		self.department = Department.objects.create(
			department_name='Library Services',
			department_college='business_economics',
		)
		self.campus_resolver = CategoryResolver.objects.create(
			category=self.category,
			campus='maraki',
			college='business_economics',
			department=self.department,
			escalation_time=timedelta(hours=1),
		)
		self.campus_college_resolver = CategoryResolver.objects.create(
			category=self.category,
			campus='maraki',
			college='business_economics',
			escalation_time=timedelta(hours=1),
		)
		self.other_resolver = CategoryResolver.objects.create(
			category=self.category,
			campus='atse_fasil',
			college='business_economics',
			escalation_time=timedelta(hours=1),
		)
		self.officer = User.objects.create_user(
			email='resolver-officer@example.com',
			password='12345678',
			first_name='Resolver',
			last_name='Officer',
			role=User.ROLE_OFFICER,
		)
		Officer.objects.create(user=self.officer, employee_id='EMP-007')
		ResolverOfficer.objects.create(resolver=self.campus_resolver, officer=self.officer)

	def test_category_resolver_list_filters_by_scope(self):
		client = APIClient()
		client.force_authenticate(user=self.user)

		response = client.get('/api/resolver-assignments/', {
			'category': str(self.category.category_id),
			'campus': 'maraki',
			'college': 'business_economics',
		})

		self.assertEqual(response.status_code, 200)
		results = response.data.get('results', [])
		returned_ids = {item['resolver_id'] for item in results}

		self.assertIn(str(self.campus_resolver.resolver_id), returned_ids)
		self.assertIn(str(self.campus_college_resolver.resolver_id), returned_ids)
		self.assertNotIn(str(self.other_resolver.resolver_id), returned_ids)

	def test_category_officers_action_filters_by_scope(self):
		client = APIClient()
		client.force_authenticate(user=self.user)

		url = f'/api/categories/{self.category.category_id}/officers/'
		response = client.get(url, {
			'campus': 'maraki',
			'college': 'business_economics',
			'department': str(self.department.id),
		})

		self.assertEqual(response.status_code, 200)
		returned_ids = {int(item['id']) for item in response.data}
		self.assertIn(self.officer.id, returned_ids)

	def test_eligible_resolvers_includes_parent_category_matches(self):
		admin = User.objects.create_user(
			email='admin@example.com',
			password='adminpass',
			first_name='Admin',
			last_name='User',
			role=User.ROLE_ADMIN,
		)

		parent = Category.objects.create(name='Parent Category', description='Parent')
		child = Category.objects.create(name='Child Category', description='Child', parent=parent)

		dept = Department.objects.create(department_name='Facilities', department_college='business_economics')

		parent_resolver = CategoryResolver.objects.create(
			category=parent,
			campus='maraki',
			college='business_economics',
			department=dept,
			escalation_time=timedelta(hours=1),
			active=True,
		)

		complaint = Complaint.objects.create(
			submitted_by=self.user,
			category=child,
			campus='maraki',
			college='business_economics',
			department=dept,
			title='Child complaint',
			description='Testing parent resolver inclusion',
		)

		client = APIClient()
		client.force_authenticate(user=admin)

		url = f'/api/complaints/{complaint.complaint_id}/eligible-resolvers/'
		response = client.get(url)

		self.assertEqual(response.status_code, 200)
		results = response.data.get('results', [])
		returned_ids = {item['resolver_id'] for item in results}

		self.assertIn(str(parent_resolver.resolver_id), returned_ids)
		# Verify parent marker and parent category name present
		for item in results:
			if str(item['resolver_id']) == str(parent_resolver.resolver_id):
				self.assertTrue(item.get('is_parent_category'))
				self.assertEqual(item.get('parent_category_name'), parent.name)
				break


class ComplaintResponseRoleVariantTests(TestCase):
	def setUp(self):
		self.officer = User.objects.create_user(
			email='variant-officer@example.com',
			password='12345678',
			first_name='Variant',
			last_name='Officer',
			role=User.ROLE_OFFICER,
		)
		Officer.objects.create(user=self.officer, employee_id='EMP-010')
		User.objects.filter(pk=self.officer.pk).update(role='main_officer')
		self.officer.refresh_from_db()

		self.user = User.objects.create_user(
			email='variant-user@example.com',
			password='12345678',
			first_name='Variant',
			last_name='User',
			role=User.ROLE_USER,
		)
		self.category = Category.objects.create(
			name='Response Routing',
			description='Response routing test category',
		)
		self.resolver = CategoryResolver.objects.create(
			category=self.category,
			escalation_time=timedelta(hours=1),
		)
		ResolverOfficer.objects.create(resolver=self.resolver, officer=self.officer)
		self.complaint = Complaint.objects.create(
			submitted_by=self.user,
			category=self.category,
			title='Response access test',
			description='Complaint used to verify officer-like role access',
			current_resolver=self.resolver,
		)

	def test_legacy_officer_role_can_create_response(self):
		client = APIClient()
		client.force_authenticate(user=self.officer)

		response = client.post('/api/responses/', {
			'complaint': str(self.complaint.complaint_id),
			'title': 'Main officer response',
			'message': 'This should be accepted for legacy officer-like roles.',
			'response_type': 'update',
			'is_public': True,
		}, format='json')

		self.assertEqual(response.status_code, 201)
		self.assertEqual(Response.objects.filter(complaint=self.complaint).count(), 1)

	def test_active_assignment_allows_response_creation(self):
		self.complaint._record_assignment(self.resolver, self.officer, 'initial')
		client = APIClient()
		client.force_authenticate(user=self.officer)

		response = client.post('/api/responses/', {
			'complaint': str(self.complaint.complaint_id),
			'title': 'Assigned officer response',
			'message': 'This should be accepted for active assignments.',
			'response_type': 'update',
			'is_public': True,
		}, format='json')

		self.assertEqual(response.status_code, 201)
		self.assertEqual(Response.objects.filter(complaint=self.complaint).count(), 1)


class ComplaintEscalationDetailsTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			email='escalation-user@example.com',
			password='12345678',
			first_name='Escalation',
			last_name='User',
			role=User.ROLE_USER,
		)
		self.officer = User.objects.create_user(
			email='escalation-officer@example.com',
			password='12345678',
			first_name='Escalation',
			last_name='Officer',
			role=User.ROLE_OFFICER,
		)
		Officer.objects.create(user=self.officer, employee_id='EMP-200')
		self.parent_category = Category.objects.create(
			name='Parent Support',
			description='Parent category for escalation',
		)
		self.child_category = Category.objects.create(
			name='Child Support',
			description='Child category for escalation',
			parent=self.parent_category,
		)
		self.department = Department.objects.create(
			department_name='Student Affairs',
			department_college='business_economics',
		)
		self.parent_resolver = CategoryResolver.objects.create(
			category=self.parent_category,
			campus='maraki',
			college='business_economics',
			department=self.department,
			escalation_time=timedelta(hours=1),
			active=True,
		)
		self.child_resolver = CategoryResolver.objects.create(
			category=self.child_category,
			campus='maraki',
			college='business_economics',
			department=self.department,
			escalation_time=timedelta(hours=1),
			active=True,
		)
		ResolverOfficer.objects.create(resolver=self.child_resolver, officer=self.officer)
		self.complaint = Complaint.objects.create(
			submitted_by=self.user,
			category=self.child_category,
			campus='maraki',
			college='business_economics',
			department=self.department,
			title='Escalation details complaint',
			description='Complaint used to inspect escalation details',
			status=Complaint.STATUS_PENDING,
			current_resolver=self.child_resolver,
			claimed_by=self.officer,
		)
		self.complaint.escalation_deadline = timezone.now() - timedelta(hours=1)
		self.complaint.save(update_fields=['escalation_deadline'])

	def test_escalation_details_include_parent_category_resolvers(self):
		original_get_due = EscalationService._get_due_complaints
		try:
			EscalationService._get_due_complaints = staticmethod(lambda now=None: [self.complaint])
			details = EscalationService.get_escalation_details()
		finally:
			EscalationService._get_due_complaints = original_get_due

		pending = details.get('pending_complaints', [])
		self.assertEqual(len(pending), 1)

		complaint_detail = pending[0]
		parent_resolvers = complaint_detail.get('parent_category_resolvers', [])
		returned_ids = {item['resolver_id'] for item in parent_resolvers}

		self.assertIn(str(self.parent_resolver.resolver_id), returned_ids)
		self.assertTrue(complaint_detail['escalation_options']['can_escalate_parent_category'])
		self.assertTrue(all(item['is_parent_category'] for item in parent_resolvers))

	def test_escalation_details_endpoint_returns_parent_resolvers(self):
		admin = User.objects.create_user(
			email='escalation-admin@example.com',
			password='12345678',
			first_name='Escalation',
			last_name='Admin',
			role=User.ROLE_ADMIN,
		)
		client = APIClient()
		client.force_authenticate(user=admin)

		original_get_due = EscalationService._get_due_complaints
		try:
			EscalationService._get_due_complaints = staticmethod(lambda now=None: [self.complaint])
			response = client.get('/api/complaints/escalation-details/')
		finally:
			EscalationService._get_due_complaints = original_get_due

		self.assertEqual(response.status_code, 200)
		pending = response.data.get('pending_complaints', [])
		self.assertEqual(len(pending), 1)
		self.assertIn('parent_category_resolvers', pending[0])

