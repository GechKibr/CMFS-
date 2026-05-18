from datetime import timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import Department, Officer, User
from complaints.views import accessible_complaints_for
from complaints.models import Category, CategoryResolver, Complaint, ResolverOfficer


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
