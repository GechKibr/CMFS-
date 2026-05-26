from rest_framework import serializers
from .models import FeedbackTemplate, TemplateField, FeedbackResponse, FeedbackAnswer
from accounts.models import CAMPUS_CHOICES, ACADEMIC_UNITS, Department, User
import uuid
import hashlib


class TemplateFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplateField
        fields = ['id', 'label', 'field_type', 'options', 'is_required', 'order', 'min_value', 'max_value']
    
    def validate(self, attrs):
        field_type = attrs.get('field_type')
        min_value = attrs.get('min_value')
        max_value = attrs.get('max_value')
        
        if field_type == TemplateField.FIELD_NUMBER:
            if min_value is not None and max_value is not None and min_value > max_value:
                raise serializers.ValidationError({
                    'min_value': 'Minimum value cannot be greater than maximum value'
                })
        else:
            # For non-number fields, min_value and max_value should not be set
            if min_value is not None or max_value is not None:
                raise serializers.ValidationError({
                    'min_value': 'Min/Max values are only valid for number fields',
                    'max_value': 'Min/Max values are only valid for number fields'
                })
        
        return attrs


class FeedbackTemplateSerializer(serializers.ModelSerializer):
    fields = TemplateFieldSerializer(many=True, read_only=True)
    created_by = serializers.CharField(source='created_by.full_name', read_only=True)
    created_by_role = serializers.SerializerMethodField()
    approved_by = serializers.CharField(source='approved_by.full_name', read_only=True, allow_null=True)
    target_campus_name = serializers.CharField(source='get_target_campus_display', read_only=True, allow_null=True)
    target_college_name = serializers.CharField(source='get_target_college_display', read_only=True, allow_null=True)
    target_department_name = serializers.CharField(source='target_department.department_name', read_only=True, allow_null=True)
    target_user_ids = serializers.SerializerMethodField()
    has_submitted = serializers.SerializerMethodField()
    user_submission = serializers.SerializerMethodField()
    created_by_officer_info = serializers.SerializerMethodField()
    
    class Meta:
        model = FeedbackTemplate
        fields = ['id', 'title', 'description', 'office', 'status', 
                 'audience_scope', 'target_campus', 'target_college', 'target_department',
                 'target_campus_name', 'target_college_name', 'target_department_name', 'target_user_ids',
                 'created_at', 'updated_at', 'fields', 
                 'created_by', 'created_by_role', 'created_by_officer_info', 'approved_by', 'approved_at',
                 'has_submitted', 'user_submission']
        read_only_fields = ['created_by', 'office', 'approved_by', 'approved_at']
    
    def get_created_by_role(self, obj):
        if obj.created_by.is_admin():
            return 'admin'
        elif obj.created_by.is_officer():
            return 'officer'
        return 'user'

    def get_created_by_officer_info(self, obj):
        """Get officer profile information including department, college, and campus"""
        officer_profile = getattr(obj.created_by, 'officer_profile', None)
        if not officer_profile:
            return None
        
        info = {
            'officer_id': obj.created_by.id,
            'officer_name': obj.created_by.full_name,
            'employee_id': officer_profile.employee_id,
            'department_id': officer_profile.department_id,
            'department_name': officer_profile.department.department_name if officer_profile.department else None,
            'college': officer_profile.college,
            'college_name': dict(ACADEMIC_UNITS).get(officer_profile.college) if officer_profile.college else None,
        }
        
        # If department exists, get its college
        if officer_profile.department:
            info['college'] = officer_profile.department.department_college
            info['college_name'] = dict(ACADEMIC_UNITS).get(officer_profile.department.department_college)
        
        return info

    def get_target_user_ids(self, obj):
        return list(obj.target_users.values_list('id', flat=True))

    def get_has_submitted(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if not request or not user or not user.is_authenticated:
            return False

        return FeedbackResponse.objects.filter(template=obj, user=user).exists()

    def get_user_submission(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if not request or not user or not user.is_authenticated:
            return None

        response = (
            FeedbackResponse.objects
            .filter(template=obj, user=user)
            .prefetch_related('answers__field')
            .order_by('-submitted_at')
            .first()
        )

        if not response:
            return None

        answers = []
        for answer in response.answers.all():
            field = answer.field
            if field.field_type == TemplateField.FIELD_TEXT:
                value = answer.text_value or ''
            elif field.field_type == TemplateField.FIELD_NUMBER:
                value = answer.number_value
            elif field.field_type == TemplateField.FIELD_RATING:
                value = answer.rating_value
            elif field.field_type == TemplateField.FIELD_CHOICE:
                value = answer.choice_value or ''
            elif field.field_type == TemplateField.FIELD_CHECKBOX:
                value = answer.checkbox_values or []
            else:
                value = None

            answers.append({
                'field_id': str(field.id),
                'label': field.label,
                'field_type': field.field_type,
                'value': value,
            })

        return {
            'id': str(response.id),
            'submitted_at': response.submitted_at.isoformat(),
            'answers': answers,
        }


class FeedbackTemplateCreateSerializer(serializers.ModelSerializer):
    fields = TemplateFieldSerializer(many=True)
    target_user_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, write_only=True, default=list)
    audience_scope = serializers.ChoiceField(choices=FeedbackTemplate.AUDIENCE_SCOPE_CHOICES, required=False, default=FeedbackTemplate.AUDIENCE_ALL)
    target_campus = serializers.ChoiceField(choices=CAMPUS_CHOICES, required=False, allow_null=True, allow_blank=True)
    target_college = serializers.ChoiceField(choices=ACADEMIC_UNITS, required=False, allow_null=True, allow_blank=True)
    target_department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    
    class Meta:
        model = FeedbackTemplate
        fields = [
            'title', 'description', 'fields',
            'audience_scope', 'target_campus', 'target_college', 'target_department', 'target_user_ids'
        ]

    def validate(self, attrs):
        audience_scope = attrs.get('audience_scope', FeedbackTemplate.AUDIENCE_ALL)
        target_campus = attrs.get('target_campus')
        target_college = attrs.get('target_college')
        target_department = attrs.get('target_department')
        target_user_ids = attrs.get('target_user_ids', [])

        if audience_scope == FeedbackTemplate.AUDIENCE_CAMPUS and not target_campus:
            raise serializers.ValidationError({'target_campus': 'Target campus is required for campus audience.'})
        if audience_scope == FeedbackTemplate.AUDIENCE_COLLEGE and not target_college:
            raise serializers.ValidationError({'target_college': 'Target college is required for college audience.'})
        if audience_scope == FeedbackTemplate.AUDIENCE_DEPARTMENT and not target_department:
            raise serializers.ValidationError({'target_department': 'Target department is required for department audience.'})
        if audience_scope == FeedbackTemplate.AUDIENCE_USERS and not target_user_ids:
            raise serializers.ValidationError({'target_user_ids': 'Select at least one user for specific users audience.'})

        # target_college is an academic-unit code now; ensure department belongs to selected academic unit
        if target_department and target_college and target_department.department_college != target_college:
            raise serializers.ValidationError({'target_department': 'Selected department does not belong to target academic unit.'})

        attrs['target_user_ids'] = list(dict.fromkeys(target_user_ids))
        return attrs
    
    def create(self, validated_data):
        fields_data = validated_data.pop('fields')
        target_user_ids = validated_data.pop('target_user_ids', [])
        user = self.context['request'].user
        
        if user.is_admin():
            status = FeedbackTemplate.STATUS_ACTIVE
        else:
            status = FeedbackTemplate.STATUS_PENDING
        
        office_name = 'General'
        officer_profile = getattr(user, 'officer_profile', None)
        student_profile = getattr(user, 'student_profile', None)
        if officer_profile:
            if officer_profile.department_id:
                office_name = officer_profile.department.department_name or office_name
            elif officer_profile.college:
                office_name = dict(ACADEMIC_UNITS).get(officer_profile.college, office_name)
        elif student_profile and student_profile.department_id:
            office_name = student_profile.department.department_name or office_name

        template = FeedbackTemplate.objects.create(
            **validated_data,
            created_by=user,
            office=office_name,
            status=status
        )

        if target_user_ids:
            target_users = User.objects.filter(id__in=target_user_ids, is_active=True)
            template.target_users.set(target_users)
        
        for field_data in fields_data:
            TemplateField.objects.create(template=template, **field_data)
        
        return template


class FeedbackAnswerSerializer(serializers.ModelSerializer):
    field_id = serializers.UUIDField(write_only=True)
    
    class Meta:
        model = FeedbackAnswer
        fields = ['field_id', 'text_value', 'number_value', 'rating_value', 
                 'choice_value', 'checkbox_values']
    
    def validate(self, attrs):
        field_id = attrs.get('field_id')
        if field_id:
            try:
                field = TemplateField.objects.get(id=field_id)
                if field.field_type == TemplateField.FIELD_NUMBER:
                    number_value = attrs.get('number_value')
                    if number_value is not None:
                        if field.min_value is not None and number_value < field.min_value:
                            raise serializers.ValidationError({
                                'number_value': f'Value must be at least {field.min_value}'
                            })
                        if field.max_value is not None and number_value > field.max_value:
                            raise serializers.ValidationError({
                                'number_value': f'Value must be at most {field.max_value}'
                            })
            except TemplateField.DoesNotExist:
                raise serializers.ValidationError({'field_id': 'Invalid field ID'})
        return attrs


class FeedbackResponseSerializer(serializers.ModelSerializer):
    answers = FeedbackAnswerSerializer(many=True)
    
    class Meta:
        model = FeedbackResponse
        fields = ['template', 'answers']
    
    def create(self, validated_data):
        answers_data = validated_data.pop('answers')
        request = self.context['request']
        
        # Generate session token
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        ip_address = self.get_client_ip(request)
        timestamp = str(uuid.uuid4())
        session_token = hashlib.sha256(f"{user_agent}{ip_address}{timestamp}".encode()).hexdigest()
        
        response = FeedbackResponse.objects.create(
            **validated_data,
            session_token=session_token,
            ip_address=ip_address,
            user=request.user
        )
        
        # Validate and create answers using the serializer
        for answer_data in answers_data:
            field_id = answer_data.pop('field_id')
            field = TemplateField.objects.get(id=field_id, template=response.template)
            answer_data['field_id'] = field_id
            
            answer_serializer = FeedbackAnswerSerializer(data=answer_data)
            answer_serializer.is_valid(raise_exception=True)
            answer_serializer.save(response=response, field=field)
        
        return response
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class FeedbackAnalyticsSerializer(serializers.Serializer):
    total_responses = serializers.IntegerField()
    field_analytics = serializers.DictField()
    response_trend = serializers.ListField()
