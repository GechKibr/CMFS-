# CMFS Backend – Mermaid Class Diagrams (StarUML)

This document contains one **Mermaid class diagram per source file** (and one full overview) for use in StarUML (via the StarUML Mermaid extension).

---

## Table of Contents

1. [accounts/models.py](#1-accountsmodelspy)
2. [accounts/serialzers.py](#2-accountsserialzerspy)
3. [accounts/views.py](#3-accountsviewspy)
4. [accounts/email_service.py](#4-accountsemail_servicepy)
5. [accounts/backends.py](#5-accountsbackendspy)
6. [accounts/utils.py](#6-accountsutilspy)
7. [accounts/signals.py](#7-accountssignalspy)
8. [accounts/microsoft_auth.py](#8-accountsmicrosoft_authpy)
9. [complaints/models.py](#9-complaintsmodelspy)
10. [complaints/serializers.py](#10-complaintsserializerspy)
11. [complaints/views.py](#11-complaintsviewspy)
12. [complaints/ai_service.py](#12-complaintsai_servicepy)
13. [complaints/escalation_service.py](#13-complaintsescalation_servicepy)
14. [complaints/scheduler.py](#14-complaintsschedulerpy)
15. [feedback/models.py](#15-feedbackmodelspy)
16. [feedback/serializers.py](#16-feedbackserializerspy)
17. [feedback/views.py](#17-feedbackviewspy)
18. [conf/ (settings & wsgi/asgi)](#18-conf-settings--wsgiasgi)
19. [Full System Overview](#19-full-system-overview-diagram)

---

## 1. accounts/models.py

```mermaid
classDiagram
    direction TB

    class AbstractBaseUser {
        <<Django>>
        +password CharField
        +last_login DateTimeField
        +is_active BooleanField
        +check_password(raw_password) bool
        +set_password(raw_password) None
        +set_unusable_password() None
        +has_usable_password() bool
    }

    class PermissionsMixin {
        <<Django>>
        +is_superuser BooleanField
        +groups ManyToManyField
        +user_permissions ManyToManyField
        +has_perm(perm, obj) bool
        +has_module_perms(app_label) bool
    }

    class BaseUserManager {
        <<Django>>
        +normalize_email(email) str
    }

    class Model {
        <<Django>>
    }

    class EmailLog {
        +STATUS_CHOICES list
        +EMAIL_TYPE_CHOICES list
        +recipient FK~User~ NULL
        +email EmailField
        +subject CharField[255]
        +message TextField
        +email_type CharField[50]
        +status CharField[20]
        +error_message TextField
        +sent_at DateTimeField
        +__str__() str
    }

    class UserManager {
        +create_user(email, password, **extra_fields) User
        +create_superuser(email, password, **extra_fields) User
    }

    class User {
        +ROLE_USER = "user"
        +ROLE_OFFICER = "officer"
        +ROLE_ADMIN = "admin"
        +ROLE_CHOICES list
        +ROLE_LEVEL dict
        +COLLEGE_CHOICES list
        +AUTH_LOCAL = "local"
        +AUTH_MICROSOFT = "microsoft"
        +AUTH_PROVIDER_CHOICES list
        +email EmailField
        +username CharField[150] UNIQUE NULL
        +campus_id CharField[20] UNIQUE NULL
        +first_name CharField[50]
        +last_name CharField[50]
        +college CharField[100] NULL
        +phone CharField[17] NULL
        +role CharField[20]
        +auth_provider CharField[20]
        +microsoft_id CharField[255] UNIQUE NULL
        +is_active BooleanField
        +is_staff BooleanField
        +is_email_verified BooleanField
        +date_joined DateTimeField
        +last_login DateTimeField NULL
        +USERNAME_FIELD = "email"
        +REQUIRED_FIELDS = ["first_name","last_name"]
        +full_name str
        +role_level int
        +is_anonymous bool
        +is_authenticated bool
        +clean() None
        +__str__() str
        +is_complainter() bool
        +is_resolver() bool
        +is_admin() bool
        +is_officer() bool
        +can_manage(other_user) bool
        +can_submit_complaint() bool
        +can_be_assigned_complaints() bool
        +can_assign_complaints() bool
        +can_escalate_complaints() bool
        +can_view_all_complaints() bool
        +get_accessible_complaints() QuerySet
    }

    class PasswordResetToken {
        +user FK~User~
        +token CharField[100] UNIQUE
        +created_at DateTimeField
        +expires_at DateTimeField
        +is_used BooleanField
        +is_valid() bool
        +__str__() str
    }

    class EmailVerificationToken {
        +user FK~User~
        +token CharField[100] UNIQUE
        +created_at DateTimeField
        +expires_at DateTimeField
        +is_used BooleanField
        +is_valid() bool
        +__str__() str
    }

    %% Inheritance
    AbstractBaseUser <|-- User
    PermissionsMixin  <|-- User
    BaseUserManager   <|-- UserManager
    Model             <|-- EmailLog
    Model             <|-- PasswordResetToken
    Model             <|-- EmailVerificationToken

    %% Associations
    UserManager       ..> User          : creates
    User              "1" --> "*" EmailLog              : recipient (SET_NULL)
    User              "1" --> "*" PasswordResetToken    : password_reset_tokens (CASCADE)
    User              "1" --> "*" EmailVerificationToken: email_verification_tokens (CASCADE)
```

---

## 2. accounts/serialzers.py

```mermaid
classDiagram
    direction TB

    class ModelSerializer {
        <<DRF>>
    }

    class Serializer {
        <<DRF>>
    }

    class UserSerializer {
        +password CharField write_only
        +confirm_password CharField write_only
        +Meta model=User
        +Meta fields list
        +validate(data) dict
        +create(validated_data) User
        +update(instance, validated_data) User
    }

    class LoginSerializer {
        +identifier CharField
        +password CharField write_only
        +validate(data) dict
    }

    class RegisterSerializer {
        +password CharField write_only
        +confirm_password CharField write_only
        +Meta model=User
        +Meta fields list
        +validate(data) dict
        +create(validated_data) User
    }

    ModelSerializer <|-- UserSerializer
    Serializer      <|-- LoginSerializer
    ModelSerializer <|-- RegisterSerializer

    UserSerializer    ..> User : serializes
    LoginSerializer   ..> User : authenticates
    RegisterSerializer ..> User : creates
```

---

## 3. accounts/views.py

```mermaid
classDiagram
    direction TB

    class ModelViewSet {
        <<DRF>>
    }

    class UserViewSet {
        +queryset QuerySet~User~
        +serializer_class UserSerializer
        +permission_classes list
        +get_serializer_class() Serializer
        +get_permissions() list
        +login(request) Response
        +register(request) Response
        +logout(request) Response
        +me(request) Response
        +verify_email(request) Response
        +request_password_reset(request) Response
        +reset_password(request) Response
    }

    ModelViewSet <|-- UserViewSet

    UserViewSet ..> UserSerializer    : uses
    UserViewSet ..> RegisterSerializer: uses
    UserViewSet ..> LoginSerializer   : uses
    UserViewSet ..> User              : manages
    UserViewSet ..> EmailService      : calls
    UserViewSet ..> PasswordResetToken: manages
    UserViewSet ..> EmailVerificationToken : manages
```

---

## 4. accounts/email_service.py

```mermaid
classDiagram
    direction TB

    class EmailService {
        +send_email(subject, message, recipient_list, email_type, recipient_user, html_message) bool$
        +send_verification_email(user, token) bool$
        +send_password_reset_email(user, token) bool$
        +send_complaint_notification(user, complaint) bool$
        +send_assignment_notification(officer, complaint) bool$
        +send_escalation_alert(officer, complaint) bool$
    }

    EmailService ..> EmailLog : logs via log_email()
    EmailService ..> User     : recipient
```

---

## 5. accounts/backends.py

```mermaid
classDiagram
    direction TB

    class ModelBackend {
        <<Django>>
        +authenticate(request, username, password, **kwargs) User
        +user_can_authenticate(user) bool
    }

    class EmailOrUsernameModelBackend {
        +authenticate(request, username, password, **kwargs) User
    }

    ModelBackend <|-- EmailOrUsernameModelBackend
    EmailOrUsernameModelBackend ..> User : looks up by email or username
```

---

## 6. accounts/utils.py

```mermaid
classDiagram
    direction TB

    class AccountsUtils {
        <<module>>
        +generate_password_reset_token(user, expiry_hours) PasswordResetToken$
        +generate_email_verification_token(user, expiry_hours) EmailVerificationToken$
        +log_email(email, subject, message, email_type, recipient, status, error_message) EmailLog$
    }

    AccountsUtils ..> PasswordResetToken    : creates
    AccountsUtils ..> EmailVerificationToken: creates
    AccountsUtils ..> EmailLog              : creates
```

---

## 7. accounts/signals.py

```mermaid
classDiagram
    direction TB

    class AccountsSignals {
        <<module>>
        +complaint_status_changed(sender, instance, created, **kwargs)$
        +complaint_assigned(sender, instance, created, **kwargs)$
    }

    AccountsSignals ..> EmailService : calls
    AccountsSignals ..> Complaint    : listens to post_save
    AccountsSignals ..> Assignment   : listens to post_save
```

---

## 8. accounts/microsoft_auth.py

```mermaid
classDiagram
    direction TB

    class MicrosoftAuthViews {
        <<module / api_views>>
        +microsoft_config_test(request) JsonResponse$
        +microsoft_login(request) redirect$
        +microsoft_callback(request) redirect$
    }

    MicrosoftAuthViews ..> User         : creates or retrieves
    MicrosoftAuthViews ..> RefreshToken : generates JWT
```

---

## 9. complaints/models.py

```mermaid
classDiagram
    direction TB

    class Model {
        <<Django>>
    }

    class Institution {
        +name CharField[255]
        +domain CharField[255] UNIQUE
        +created_at DateTimeField
        +__str__() str
    }

    class Category {
        +category_id CharField[30] PK
        +institution FK~Institution~ NULL
        +name CharField[100]
        +name_amharic CharField[100]
        +description TextField
        +description_amharic TextField
        +parent FK~Category~ NULL
        +is_active BooleanField
        +created_at DateTimeField
        +save(*args, **kwargs) None
        +__str__() str
    }

    class ResolverLevel {
        +institution FK~Institution~
        +name CharField[100]
        +level_order PositiveIntegerField
        +escalation_time DurationField
        +__str__() str
    }

    class CategoryResolver {
        +category FK~Category~
        +level FK~ResolverLevel~
        +officer FK~User~
        +active BooleanField
        +__str__() str
    }

    class Complaint {
        +STATUS_CHOICES list
        +PRIORITY_CHOICES list
        +complaint_id UUIDField PK
        +institution FK~Institution~ NULL
        +submitted_by FK~User~
        +category FK~Category~ NULL
        +title CharField[255]
        +description TextField
        +attachment FileField
        +status CharField[20]
        +priority CharField[10]
        +current_level FK~ResolverLevel~ NULL
        +assigned_officer FK~User~ NULL
        +escalation_deadline DateTimeField NULL
        +created_at DateTimeField
        +updated_at DateTimeField
        +set_escalation_deadline() None
        +save(*args, **kwargs) None
        +escalate_to_next_level() bool
        +__str__() str
    }

    class ComplaintAttachment {
        +complaint FK~Complaint~
        +file FileField
        +filename CharField[255]
        +file_size PositiveIntegerField
        +content_type CharField[100]
        +uploaded_at DateTimeField
        +__str__() str
    }

    class Assignment {
        +ASSIGNMENT_REASON list
        +complaint FK~Complaint~
        +officer FK~User~
        +level FK~ResolverLevel~
        +assigned_at DateTimeField
        +ended_at DateTimeField NULL
        +reason CharField[20]
        +__str__() str
    }

    class Comment {
        +COMMENT_TYPE_CHOICES list
        +complaint FK~Complaint~
        +author FK~User~
        +comment_type CharField[20]
        +message TextField
        +rating IntegerField NULL
        +created_at DateTimeField
        +updated_at DateTimeField
        +clean() None
        +__str__() str
    }

    class Response {
        +RESPONSE_TYPE_CHOICES list
        +complaint FK~Complaint~
        +responder FK~User~
        +response_type CharField[20]
        +title CharField[255]
        +message TextField
        +attachment FileField NULL
        +is_public BooleanField
        +created_at DateTimeField
        +updated_at DateTimeField
        +__str__() str
    }

    class Notification {
        +NOTIFICATION_TYPE_CHOICES list
        +user FK~User~
        +complaint FK~Complaint~ NULL
        +notification_type CharField[30]
        +title CharField[255]
        +message TextField
        +is_read BooleanField
        +read_at DateTimeField NULL
        +created_at DateTimeField
        +mark_as_read() None
        +get_unread_for_user(user) QuerySet$
        +get_escalation_notifications(user) QuerySet$
        +__str__() str
    }

    class AISettingsConfig {
        +STRATEGY_CHOICES list
        +auto_category BooleanField
        +auto_assignment BooleanField
        +auto_priority BooleanField
        +smart_routing BooleanField
        +assignment_strategy CharField[30]
        +confidence_threshold PositiveIntegerField
        +max_retries PositiveIntegerField
        +learning_mode BooleanField
        +last_trained DateTimeField NULL
        +updated_at DateTimeField
        +__str__() str
    }

    class AIPriorityKeyword {
        +PRIORITY_CHOICES list
        +priority CharField[10]
        +word CharField[100]
        +__str__() str
    }

    %% Inheritance
    Model <|-- Institution
    Model <|-- Category
    Model <|-- ResolverLevel
    Model <|-- CategoryResolver
    Model <|-- Complaint
    Model <|-- ComplaintAttachment
    Model <|-- Assignment
    Model <|-- Comment
    Model <|-- Response
    Model <|-- Notification
    Model <|-- AISettingsConfig
    Model <|-- AIPriorityKeyword

    %% Associations
    Institution      "1" --> "*" Category        : categories (CASCADE)
    Institution      "1" --> "*" ResolverLevel   : resolver_levels (CASCADE)
    Institution      "1" --> "*" Complaint       : complaints (CASCADE)
    Category         "0..1" --> "*" Category     : children (self-ref, CASCADE)
    Category         "1" --> "*" CategoryResolver: resolvers (CASCADE)
    ResolverLevel    "1" --> "*" CategoryResolver: category_resolvers (CASCADE)
    ResolverLevel    "1" --> "*" Complaint       : complaints (SET_NULL)
    ResolverLevel    "1" --> "*" Assignment      : (CASCADE)
    User             "1" --> "*" CategoryResolver: assigned_categories (CASCADE)
    User             "1" --> "*" Complaint       : complaints_made (CASCADE)
    User             "1" --> "*" Complaint       : active_complaints (SET_NULL)
    User             "1" --> "*" Assignment      : assignment_history (CASCADE)
    User             "1" --> "*" Comment         : (CASCADE)
    User             "1" --> "*" Response        : complaint_responses (CASCADE)
    User             "1" --> "*" Notification    : notifications (CASCADE)
    Complaint        "1" --> "*" ComplaintAttachment : attachments (CASCADE)
    Complaint        "1" --> "*" Assignment      : assignments (CASCADE)
    Complaint        "1" --> "*" Comment         : comments (CASCADE)
    Complaint        "1" --> "*" Response        : responses (CASCADE)
    Complaint        "0..1" --> "*" Notification : notifications (CASCADE)
    Complaint        ..> Assignment              : creates via escalate_to_next_level()
```

---

## 10. complaints/serializers.py

```mermaid
classDiagram
    direction TB

    class ModelSerializer {
        <<DRF>>
    }

    class Serializer {
        <<DRF>>
    }

    class ComplaintUserSerializer {
        +Meta model=User
        +Meta fields [id, username, email, first_name, last_name]
    }

    class InstitutionSerializer {
        +Meta model=Institution
        +Meta fields [id, name, domain, created_at]
    }

    class CategorySerializer {
        +institution_name CharField read_only
        +parent_name CharField read_only
        +Meta model=Category
        +Meta fields list
    }

    class ResolverLevelSerializer {
        +institution_name CharField read_only
        +Meta model=ResolverLevel
        +Meta fields list
    }

    class CategoryResolverSerializer {
        +officer_name CharField read_only
        +level_name CharField read_only
        +category_name CharField read_only
        +Meta model=CategoryResolver
        +Meta fields list
    }

    class ComplaintCreateSerializer {
        +Meta model=Complaint
        +Meta fields [title, description, institution, attachment, priority]
    }

    class ComplaintAttachmentSerializer {
        +Meta model=ComplaintAttachment
        +Meta fields list
    }

    class ComplaintSerializer {
        +submitted_by ComplaintUserSerializer read_only
        +category CategorySerializer read_only
        +assigned_officer ComplaintUserSerializer read_only
        +current_level ResolverLevelSerializer read_only
        +attachments ComplaintAttachmentSerializer many read_only
        +Meta model=Complaint
        +Meta fields list
        +create(validated_data) Complaint
    }

    class CommentSerializer {
        +author ComplaintUserSerializer read_only
        +Meta model=Comment
        +Meta fields list
    }

    class ResponseSerializer {
        +responder ComplaintUserSerializer read_only
        +Meta model=Response
        +Meta fields list
    }

    class AssignmentSerializer {
        +officer ComplaintUserSerializer read_only
        +Meta model=Assignment
        +Meta fields list
    }

    class NotificationSerializer {
        +complaint_title CharField read_only
        +complaint_id CharField read_only
        +Meta model=Notification
        +Meta fields list
    }

    class AISettingsConfigSerializer {
        +Meta model=AISettingsConfig
        +Meta fields list
    }

    class AIPriorityKeywordSerializer {
        +Meta model=AIPriorityKeyword
        +Meta fields [id, priority, word]
    }

    ModelSerializer <|-- ComplaintUserSerializer
    ModelSerializer <|-- InstitutionSerializer
    ModelSerializer <|-- CategorySerializer
    ModelSerializer <|-- ResolverLevelSerializer
    ModelSerializer <|-- CategoryResolverSerializer
    ModelSerializer <|-- ComplaintCreateSerializer
    ModelSerializer <|-- ComplaintAttachmentSerializer
    ModelSerializer <|-- ComplaintSerializer
    ModelSerializer <|-- CommentSerializer
    ModelSerializer <|-- ResponseSerializer
    ModelSerializer <|-- AssignmentSerializer
    ModelSerializer <|-- NotificationSerializer
    ModelSerializer <|-- AISettingsConfigSerializer
    ModelSerializer <|-- AIPriorityKeywordSerializer

    ComplaintSerializer *-- ComplaintUserSerializer   : nested submitted_by / officer
    ComplaintSerializer *-- CategorySerializer        : nested category
    ComplaintSerializer *-- ResolverLevelSerializer   : nested current_level
    ComplaintSerializer *-- ComplaintAttachmentSerializer : nested attachments
    CommentSerializer   *-- ComplaintUserSerializer   : nested author
    ResponseSerializer  *-- ComplaintUserSerializer   : nested responder
    AssignmentSerializer *-- ComplaintUserSerializer  : nested officer
```

---

## 11. complaints/views.py

```mermaid
classDiagram
    direction TB

    class ModelViewSet {
        <<DRF>>
    }

    class InstitutionViewSet {
        +queryset QuerySet~Institution~
        +serializer_class InstitutionSerializer
        +permission_classes list
    }

    class CategoryViewSet {
        +queryset QuerySet~Category~
        +serializer_class CategorySerializer
        +permission_classes list
        +by_language(request) Response
        +add_officer(request, pk) Response
    }

    class ResolverLevelViewSet {
        +queryset QuerySet~ResolverLevel~
        +serializer_class ResolverLevelSerializer
        +permission_classes list
    }

    class CategoryResolverViewSet {
        +queryset QuerySet~CategoryResolver~
        +serializer_class CategoryResolverSerializer
        +permission_classes list
    }

    class ComplaintViewSet {
        +queryset QuerySet~Complaint~
        +permission_classes list
        +get_serializer_class() Serializer
        +get_queryset() QuerySet
        +create(request, *args, **kwargs) Response
        +assign(request, pk) Response
        +reassign(request, pk) Response
        +change_status(request, pk) Response
        +escalate(request, pk) Response
        +get_responses(request, pk) Response
        +get_comments(request, pk) Response
        +ai_settings(request) Response
        +add_ai_keyword(request) Response
        +delete_ai_keyword(request, keyword_id) Response
        +retrain_ai_model(request) Response
        +ai_categorize(request, pk) Response
    }

    class CommentViewSet {
        +queryset QuerySet~Comment~
        +serializer_class CommentSerializer
        +permission_classes list
        +perform_create(serializer) None
        +update(request, *args, **kwargs) Response
        +destroy(request, *args, **kwargs) Response
        +get_queryset() QuerySet
    }

    class ResponseViewSet {
        +queryset QuerySet~Response~
        +serializer_class ResponseSerializer
        +permission_classes list
        +perform_create(serializer) None
        +get_queryset() QuerySet
        +destroy(request, *args, **kwargs) Response
        +update(request, *args, **kwargs) Response
    }

    class NotificationViewSet {
        +serializer_class NotificationSerializer
        +permission_classes list
        +get_queryset() QuerySet
        +unread(request) Response
        +escalations(request) Response
        +mark_as_read(request, pk) Response
        +mark_all_as_read(request) Response
    }

    class AssignmentViewSet {
        +queryset QuerySet~Assignment~
        +serializer_class AssignmentSerializer
        +permission_classes list
    }

    ModelViewSet <|-- InstitutionViewSet
    ModelViewSet <|-- CategoryViewSet
    ModelViewSet <|-- ResolverLevelViewSet
    ModelViewSet <|-- CategoryResolverViewSet
    ModelViewSet <|-- ComplaintViewSet
    ModelViewSet <|-- CommentViewSet
    ModelViewSet <|-- ResponseViewSet
    ModelViewSet <|-- NotificationViewSet
    ModelViewSet <|-- AssignmentViewSet

    ComplaintViewSet ..> ComplaintAIService : processes via ai_service
    ComplaintViewSet ..> Assignment         : creates
    ComplaintViewSet ..> AISettingsConfig   : manages
    ComplaintViewSet ..> AIPriorityKeyword  : manages
```

---

## 12. complaints/ai_service.py

```mermaid
classDiagram
    direction TB

    class ComplaintAIService {
        -model SentenceTransformer
        +__init__() None
        -_load_model() None
        +get_category_embeddings(institution) tuple
        -_get_category_keywords(category, limit) list
        +predict_category(complaint_text, institution, return_probabilities) Category
        -_preprocess_text(text) str
        -_softmax(x) ndarray
        -_calculate_confidence(similarity, probabilities) float
        -_get_dynamic_threshold(best_match, top_matches) float
        +predict_priority(complaint_text, category) str
        +assign_to_first_level_officer(complaint) User
        +process_complaint(complaint) dict
        +get_category_suggestions(complaint_text, institution, top_n) list
    }

    ComplaintAIService ..> Category         : predicts / queries
    ComplaintAIService ..> Complaint        : processes
    ComplaintAIService ..> CategoryResolver : queries
    ComplaintAIService ..> ResolverLevel    : queries
    ComplaintAIService ..> Assignment       : creates
```

---

## 13. complaints/escalation_service.py

```mermaid
classDiagram
    direction TB

    class EscalationService {
        +check_and_escalate_complaints() dict$
        +send_escalation_notifications(complaint) None$
        +notify_admin_max_escalation(complaint) None$
        -_notify_institution_admin(complaint) None$
        -_create_notification(user, complaint, notification_type, title, message) None$
        +get_escalation_statistics() dict$
        +set_escalation_deadline(complaint) bool$
    }

    EscalationService ..> Complaint    : queries & escalates
    EscalationService ..> Assignment   : reads
    EscalationService ..> ResolverLevel: queries
    EscalationService ..> CategoryResolver : queries
    EscalationService ..> EmailService : sends notifications
    EscalationService ..> User         : notifies admins
    EscalationService ..> Notification : creates
```

---

## 14. complaints/scheduler.py

```mermaid
classDiagram
    direction TB

    class EscalationScheduler {
        <<module>>
        +check_escalations_task() None$
        +start_escalation_scheduler() BackgroundScheduler$
    }

    EscalationScheduler ..> EscalationService : calls check_and_escalate_complaints()
```

---

## 15. feedback/models.py

```mermaid
classDiagram
    direction TB

    class Model {
        <<Django>>
    }

    class FeedbackTemplate {
        +STATUS_DRAFT = "draft"
        +STATUS_ACTIVE = "active"
        +STATUS_CLOSED = "closed"
        +STATUS_PENDING = "pending"
        +STATUS_REJECTED = "rejected"
        +STATUS_INACTIVE = "inactive"
        +STATUS_CHOICES list
        +PRIORITY_LOW = "low"
        +PRIORITY_MEDIUM = "medium"
        +PRIORITY_HIGH = "high"
        +PRIORITY_CHOICES list
        +id UUIDField PK
        +title CharField[200]
        +description TextField
        +created_by FK~User~
        +office CharField[100]
        +status CharField[20]
        +priority CharField[20]
        +approved_by FK~User~ NULL
        +approved_at DateTimeField NULL
        +created_at DateTimeField
        +updated_at DateTimeField
        +__str__() str
    }

    class TemplateField {
        +FIELD_TEXT = "text"
        +FIELD_NUMBER = "number"
        +FIELD_RATING = "rating"
        +FIELD_CHOICE = "choice"
        +FIELD_CHECKBOX = "checkbox"
        +FIELD_TYPE_CHOICES list
        +id UUIDField PK
        +template FK~FeedbackTemplate~
        +label CharField[200]
        +field_type CharField[20]
        +options JSONField
        +is_required BooleanField
        +order PositiveIntegerField
        +__str__() str
    }

    class FeedbackResponse {
        +id UUIDField PK
        +template FK~FeedbackTemplate~
        +user FK~User~ NULL
        +session_token CharField[100] UNIQUE
        +submitted_at DateTimeField
        +ip_address GenericIPAddressField NULL
        +__str__() str
    }

    class FeedbackAnswer {
        +id UUIDField PK
        +response FK~FeedbackResponse~
        +field FK~TemplateField~
        +text_value TextField NULL
        +number_value FloatField NULL
        +rating_value IntegerField NULL
        +choice_value CharField[200] NULL
        +checkbox_values JSONField
        +value any
        +__str__() str
    }

    %% Inheritance
    Model <|-- FeedbackTemplate
    Model <|-- TemplateField
    Model <|-- FeedbackResponse
    Model <|-- FeedbackAnswer

    %% Associations
    User             "1" --> "*" FeedbackTemplate  : feedback_templates (CASCADE)
    User             "1" --> "*" FeedbackTemplate  : approved_templates (SET_NULL)
    User             "1" --> "*" FeedbackResponse  : feedback_responses (CASCADE)
    FeedbackTemplate "1" --> "*" TemplateField     : fields (CASCADE)
    FeedbackTemplate "1" --> "*" FeedbackResponse  : responses (CASCADE)
    FeedbackResponse "1" --> "*" FeedbackAnswer    : answers (CASCADE)
    TemplateField    "1" --> "*" FeedbackAnswer    : answers (CASCADE)
```

---

## 16. feedback/serializers.py

```mermaid
classDiagram
    direction TB

    class ModelSerializer {
        <<DRF>>
    }

    class Serializer {
        <<DRF>>
    }

    class TemplateFieldSerializer {
        +Meta model=TemplateField
        +Meta fields [id, label, field_type, options, is_required, order]
    }

    class FeedbackTemplateSerializer {
        +fields TemplateFieldSerializer many read_only
        +created_by CharField read_only
        +created_by_role SerializerMethodField
        +approved_by CharField read_only
        +Meta model=FeedbackTemplate
        +Meta fields list
        +get_created_by_role(obj) str
    }

    class FeedbackTemplateCreateSerializer {
        +fields TemplateFieldSerializer many
        +Meta model=FeedbackTemplate
        +Meta fields [title, description, fields, priority]
        +create(validated_data) FeedbackTemplate
    }

    class FeedbackAnswerSerializer {
        +field_id UUIDField write_only
        +Meta model=FeedbackAnswer
        +Meta fields list
    }

    class FeedbackResponseSerializer {
        +answers FeedbackAnswerSerializer many
        +Meta model=FeedbackResponse
        +Meta fields [template, answers]
        +create(validated_data) FeedbackResponse
        +get_client_ip(request) str
    }

    class FeedbackAnalyticsSerializer {
        +total_responses IntegerField
        +field_analytics DictField
        +response_trend ListField
    }

    ModelSerializer <|-- TemplateFieldSerializer
    ModelSerializer <|-- FeedbackTemplateSerializer
    ModelSerializer <|-- FeedbackTemplateCreateSerializer
    ModelSerializer <|-- FeedbackAnswerSerializer
    ModelSerializer <|-- FeedbackResponseSerializer
    Serializer      <|-- FeedbackAnalyticsSerializer

    FeedbackTemplateSerializer      *-- TemplateFieldSerializer        : nested fields
    FeedbackTemplateCreateSerializer *-- TemplateFieldSerializer       : nested fields
    FeedbackResponseSerializer       *-- FeedbackAnswerSerializer      : nested answers

    FeedbackTemplateCreateSerializer ..> FeedbackTemplate : creates
    FeedbackTemplateCreateSerializer ..> TemplateField    : creates fields
    FeedbackResponseSerializer       ..> FeedbackResponse : creates
    FeedbackResponseSerializer       ..> FeedbackAnswer   : creates answers
```

---

## 17. feedback/views.py

```mermaid
classDiagram
    direction TB

    class ModelViewSet {
        <<DRF>>
    }

    class FeedbackTemplateViewSet {
        +queryset QuerySet~FeedbackTemplate~
        +get_serializer_class() Serializer
        +get_permissions() list
        +get_queryset() QuerySet
        +perform_create(serializer) None
        +perform_update(serializer) None
        +perform_destroy(instance) None
        +activate(request, pk) Response
        +deactivate(request, pk) Response
        +approve(request, pk) Response
        +reject(request, pk) Response
        +analytics(request, pk) Response
    }

    class FeedbackResponseViewSet {
        +queryset QuerySet~FeedbackResponse~
        +serializer_class FeedbackResponseSerializer
        +permission_classes list
        +http_method_names list
        +create(request, *args, **kwargs) Response
    }

    ModelViewSet <|-- FeedbackTemplateViewSet
    ModelViewSet <|-- FeedbackResponseViewSet

    FeedbackTemplateViewSet ..> FeedbackTemplate         : manages
    FeedbackTemplateViewSet ..> FeedbackTemplateSerializer: uses
    FeedbackTemplateViewSet ..> FeedbackTemplateCreateSerializer : uses
    FeedbackTemplateViewSet ..> FeedbackAnalyticsSerializer : uses
    FeedbackResponseViewSet ..> FeedbackResponse          : creates
    FeedbackResponseViewSet ..> FeedbackResponseSerializer : uses
```

---

## 18. conf/ (settings & wsgi/asgi)

```mermaid
classDiagram
    direction TB

    class DjangoSettings {
        <<conf/settings.py>>
        +SECRET_KEY str
        +DEBUG bool
        +ALLOWED_HOSTS list
        +INSTALLED_APPS list
        +MIDDLEWARE list
        +ROOT_URLCONF str
        +DATABASES dict
        +AUTH_USER_MODEL = "accounts.User"
        +REST_FRAMEWORK dict
        +SIMPLE_JWT dict
        +CORS_ALLOWED_ORIGINS list
        +DEFAULT_FROM_EMAIL str
        +FRONTEND_URL str
        +AUTHENTICATION_BACKENDS list
        +MEDIA_ROOT str
        +MEDIA_URL str
        +STATIC_ROOT str
        +STATIC_URL str
    }

    class RootURLConf {
        <<conf/urls.py>>
        +urlpatterns list
    }

    class JWTSessionMiddleware {
        <<conf/jwt_session.py>>
        +__init__(get_response) None
        +__call__(request) Response
    }

    class SystemMonitor {
        <<conf/system_monitor.py>>
        +get_system_stats() dict$
        +get_database_stats() dict$
        +get_application_stats() dict$
    }

    class ASGIApplication {
        <<conf/asgi.py>>
        +application ASGIHandler
    }

    class WSGIApplication {
        <<conf/wsgi.py>>
        +application WSGIHandler
    }

    DjangoSettings ..> RootURLConf         : configures
    DjangoSettings ..> JWTSessionMiddleware : configures
    RootURLConf    ..> UserViewSet          : routes
    RootURLConf    ..> ComplaintViewSet     : routes
    RootURLConf    ..> FeedbackTemplateViewSet : routes
```

---

## 19. Full System Overview Diagram

This diagram shows the complete cross-app class relationships for the entire CMFS backend.

```mermaid
classDiagram
    direction TB

    %% ─────────────── accounts ───────────────
    class User {
        +email EmailField
        +username CharField
        +campus_id CharField
        +first_name CharField
        +last_name CharField
        +college CharField
        +phone CharField
        +role CharField
        +auth_provider CharField
        +microsoft_id CharField
        +is_active BooleanField
        +is_staff BooleanField
        +is_email_verified BooleanField
        +date_joined DateTimeField
        +full_name str
        +role_level int
        +is_complainter() bool
        +is_resolver() bool
        +is_admin() bool
        +is_officer() bool
        +can_submit_complaint() bool
        +can_be_assigned_complaints() bool
        +can_assign_complaints() bool
        +can_escalate_complaints() bool
        +can_view_all_complaints() bool
        +get_accessible_complaints() QuerySet
    }

    class EmailLog {
        +recipient FK~User~
        +email EmailField
        +subject CharField
        +message TextField
        +email_type CharField
        +status CharField
        +sent_at DateTimeField
    }

    class PasswordResetToken {
        +user FK~User~
        +token CharField
        +expires_at DateTimeField
        +is_used BooleanField
        +is_valid() bool
    }

    class EmailVerificationToken {
        +user FK~User~
        +token CharField
        +expires_at DateTimeField
        +is_used BooleanField
        +is_valid() bool
    }

    class EmailService {
        +send_email(subject, message, recipient_list, ...) bool$
        +send_verification_email(user, token) bool$
        +send_password_reset_email(user, token) bool$
        +send_complaint_notification(user, complaint) bool$
        +send_assignment_notification(officer, complaint) bool$
        +send_escalation_alert(officer, complaint) bool$
    }

    class EmailOrUsernameModelBackend {
        +authenticate(request, username, password) User
    }

    %% ─────────────── complaints ───────────────
    class Institution {
        +name CharField
        +domain CharField
        +created_at DateTimeField
    }

    class Category {
        +category_id CharField PK
        +institution FK~Institution~
        +name CharField
        +name_amharic CharField
        +description TextField
        +description_amharic TextField
        +parent FK~Category~
        +is_active BooleanField
        +created_at DateTimeField
    }

    class ResolverLevel {
        +institution FK~Institution~
        +name CharField
        +level_order PositiveIntegerField
        +escalation_time DurationField
    }

    class CategoryResolver {
        +category FK~Category~
        +level FK~ResolverLevel~
        +officer FK~User~
        +active BooleanField
    }

    class Complaint {
        +complaint_id UUIDField PK
        +institution FK~Institution~
        +submitted_by FK~User~
        +category FK~Category~
        +title CharField
        +description TextField
        +status CharField
        +priority CharField
        +current_level FK~ResolverLevel~
        +assigned_officer FK~User~
        +escalation_deadline DateTimeField
        +created_at DateTimeField
        +updated_at DateTimeField
        +set_escalation_deadline() None
        +escalate_to_next_level() bool
    }

    class ComplaintAttachment {
        +complaint FK~Complaint~
        +file FileField
        +filename CharField
        +file_size PositiveIntegerField
        +content_type CharField
        +uploaded_at DateTimeField
    }

    class Assignment {
        +complaint FK~Complaint~
        +officer FK~User~
        +level FK~ResolverLevel~
        +assigned_at DateTimeField
        +ended_at DateTimeField
        +reason CharField
    }

    class Comment {
        +complaint FK~Complaint~
        +author FK~User~
        +comment_type CharField
        +message TextField
        +rating IntegerField
        +created_at DateTimeField
    }

    class Response {
        +complaint FK~Complaint~
        +responder FK~User~
        +response_type CharField
        +title CharField
        +message TextField
        +is_public BooleanField
        +created_at DateTimeField
    }

    class Notification {
        +user FK~User~
        +complaint FK~Complaint~
        +notification_type CharField
        +title CharField
        +message TextField
        +is_read BooleanField
        +read_at DateTimeField
        +created_at DateTimeField
        +mark_as_read() None
        +get_unread_for_user(user) QuerySet$
    }

    class AISettingsConfig {
        +auto_category BooleanField
        +auto_assignment BooleanField
        +auto_priority BooleanField
        +smart_routing BooleanField
        +assignment_strategy CharField
        +confidence_threshold PositiveIntegerField
        +max_retries PositiveIntegerField
        +learning_mode BooleanField
        +last_trained DateTimeField
    }

    class AIPriorityKeyword {
        +priority CharField
        +word CharField
    }

    class ComplaintAIService {
        -model SentenceTransformer
        +predict_category(text, institution, return_probs) Category
        +predict_priority(text, category) str
        +assign_to_first_level_officer(complaint) User
        +process_complaint(complaint) dict
        +get_category_suggestions(text, institution, top_n) list
    }

    class EscalationService {
        +check_and_escalate_complaints() dict$
        +send_escalation_notifications(complaint) None$
        +notify_admin_max_escalation(complaint) None$
        +get_escalation_statistics() dict$
    }

    %% ─────────────── feedback ───────────────
    class FeedbackTemplate {
        +id UUIDField PK
        +title CharField
        +description TextField
        +created_by FK~User~
        +office CharField
        +status CharField
        +priority CharField
        +approved_by FK~User~
        +approved_at DateTimeField
        +created_at DateTimeField
    }

    class TemplateField {
        +id UUIDField PK
        +template FK~FeedbackTemplate~
        +label CharField
        +field_type CharField
        +options JSONField
        +is_required BooleanField
        +order PositiveIntegerField
    }

    class FeedbackResponse {
        +id UUIDField PK
        +template FK~FeedbackTemplate~
        +user FK~User~
        +session_token CharField
        +submitted_at DateTimeField
        +ip_address GenericIPAddressField
    }

    class FeedbackAnswer {
        +id UUIDField PK
        +response FK~FeedbackResponse~
        +field FK~TemplateField~
        +text_value TextField
        +number_value FloatField
        +rating_value IntegerField
        +choice_value CharField
        +checkbox_values JSONField
        +value any
    }

    %% ─────────────── ViewSets ───────────────
    class UserViewSet {
        +login(request) Response
        +register(request) Response
        +logout(request) Response
        +me(request) Response
        +verify_email(request) Response
        +request_password_reset(request) Response
        +reset_password(request) Response
    }

    class ComplaintViewSet {
        +create(request) Response
        +assign(request, pk) Response
        +reassign(request, pk) Response
        +change_status(request, pk) Response
        +escalate(request, pk) Response
        +ai_settings(request) Response
        +ai_categorize(request, pk) Response
    }

    class FeedbackTemplateViewSet {
        +activate(request, pk) Response
        +deactivate(request, pk) Response
        +approve(request, pk) Response
        +reject(request, pk) Response
        +analytics(request, pk) Response
    }

    %% ─────────────── Relationships ───────────────

    %% User relationships
    User "1" --> "*" EmailLog              : email_logs
    User "1" --> "*" PasswordResetToken    : password_reset_tokens
    User "1" --> "*" EmailVerificationToken: email_verification_tokens
    User "1" --> "*" CategoryResolver      : assigned_categories
    User "1" --> "*" Complaint             : complaints_made
    User "1" --> "*" Complaint             : active_complaints (assigned)
    User "1" --> "*" Assignment            : assignment_history
    User "1" --> "*" Comment               : authored
    User "1" --> "*" Response              : complaint_responses
    User "1" --> "*" Notification          : notifications
    User "1" --> "*" FeedbackTemplate      : feedback_templates
    User "1" --> "*" FeedbackResponse      : feedback_responses

    %% Institution relationships
    Institution "1" --> "*" Category       : categories
    Institution "1" --> "*" ResolverLevel  : resolver_levels
    Institution "1" --> "*" Complaint      : complaints

    %% Category relationships
    Category "0..1" --> "*" Category       : children (self-ref)
    Category "1" --> "*" CategoryResolver  : resolvers
    Category "1" --> "*" Complaint         : complaints (SET_NULL)

    %% ResolverLevel relationships
    ResolverLevel "1" --> "*" CategoryResolver : category_resolvers
    ResolverLevel "1" --> "*" Complaint        : complaints
    ResolverLevel "1" --> "*" Assignment       : assignments

    %% Complaint relationships
    Complaint "1" *-- "*" ComplaintAttachment : attachments
    Complaint "1" *-- "*" Assignment          : assignments
    Complaint "1" *-- "*" Comment             : comments
    Complaint "1" *-- "*" Response            : responses
    Complaint "1" *-- "*" Notification        : notifications

    %% Feedback relationships
    FeedbackTemplate "1" *-- "*" TemplateField    : fields
    FeedbackTemplate "1" *-- "*" FeedbackResponse : responses
    FeedbackResponse "1" *-- "*" FeedbackAnswer   : answers
    TemplateField    "1" --> "*" FeedbackAnswer   : answers

    %% Service relationships
    EmailService       ..> EmailLog     : creates
    EmailService       ..> User         : sends to
    ComplaintAIService ..> Complaint    : processes
    ComplaintAIService ..> Category     : predicts
    ComplaintAIService ..> Assignment   : creates
    EscalationService  ..> Complaint    : escalates
    EscalationService  ..> EmailService : uses
    EscalationService  ..> Notification : creates

    %% ViewSet relationships
    UserViewSet         ..> User        : manages
    UserViewSet         ..> EmailService: uses
    ComplaintViewSet    ..> Complaint   : manages
    ComplaintViewSet    ..> ComplaintAIService : uses
    FeedbackTemplateViewSet ..> FeedbackTemplate : manages
```
