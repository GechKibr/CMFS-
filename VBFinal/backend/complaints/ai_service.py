from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from complaints.models import Category, Complaint, CategoryResolver, ResolverLevel, Assignment
from django.core.cache import cache
from django.db import models
import logging

logger = logging.getLogger(__name__)


class ComplaintAIService:
   
    
    def __init__(self):
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load sentence transformer model"""
        try:
            # Use lightweight model for better performance
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("AI model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load AI model: {e}")
            self.model = None
    
    def get_category_embeddings(self, institution=None):
        """Get or compute embeddings for all categories"""
        cache_key = f"category_embeddings_{institution.id if institution else 'all'}"
        embeddings = cache.get(cache_key)
        
        if embeddings is None:
            categories = Category.objects.filter(is_active=True)
            if institution:
                categories = categories.filter(models.Q(institution=institution) | models.Q(institution__isnull=True))
            
            if not categories.exists():
                return {}, []
            
            # Create text representations
            category_texts = []
            category_ids = []
            
            for cat in categories:
                text = f"{cat.name} {cat.description}"
                category_texts.append(text)
                category_ids.append(cat.category_id)
            
            # Generate embeddings
            if self.model:
                embeddings_array = self.model.encode(category_texts)
                embeddings = {
                    'ids': category_ids,
                    'embeddings': embeddings_array
                }
                # Cache for 1 hour
                cache.set(cache_key, embeddings, 3600)
            else:
                return {}, []
        
        return embeddings.get('ids', []), embeddings.get('embeddings', [])
    
    def predict_category(self, complaint_text, institution=None):
        """Predict the best matching category for a complaint"""
        if not self.model:
            return None
        
        try:
            # Get category embeddings
            category_ids, category_embeddings = self.get_category_embeddings(institution)
            
            if not category_ids:
                return None
            
            # Encode complaint
            complaint_embedding = self.model.encode([complaint_text])
            
            # Calculate similarities
            similarities = cosine_similarity(complaint_embedding, category_embeddings)[0]
            
            # Get best match
            best_idx = np.argmax(similarities)
            best_score = similarities[best_idx]
            
            # Only return if confidence is reasonable (>0.3)
            if best_score > 0.3:
                return Category.objects.get(category_id=category_ids[best_idx])
            
            return None
        except Exception as e:
            logger.error(f"Category prediction failed: {e}")
            return None
    
    def predict_priority(self, complaint_text, category=None):
        """Predict priority based on complaint text"""
        if not self.model:
            return 'medium'
        
        try:
            # Keywords for priority detection
            urgent_keywords = ['urgent', 'emergency', 'critical', 'immediate', 'asap', 'danger', 'threat', 'harassment', 'assault']
            high_keywords = ['important', 'serious', 'significant', 'major', 'severe']
            low_keywords = ['minor', 'small', 'suggestion', 'feedback', 'question']
            
            text_lower = complaint_text.lower()
            
            # Check for urgent keywords
            if any(keyword in text_lower for keyword in urgent_keywords):
                return 'urgent'
            
            # Check for high priority keywords
            if any(keyword in text_lower for keyword in high_keywords):
                return 'high'
            
            # Check for low priority keywords
            if any(keyword in text_lower for keyword in low_keywords):
                return 'low'
            
            # Default to medium
            return 'medium'
        except Exception as e:
            logger.error(f"Priority prediction failed: {e}")
            return 'medium'
    
    def assign_to_first_level_officer(self, complaint):
        """Assign complaint to first level officer based on category"""
        try:
            if not complaint.category:
                return None
            
            # Get first level resolver for this category
            if complaint.institution:
                first_level = ResolverLevel.objects.filter(
                    institution=complaint.institution,
                    level_order=1
                ).first()
            else:
                # If no institution, get any first level
                first_level = ResolverLevel.objects.filter(level_order=1).first()
            
            if not first_level:
                return None
            
            # Get resolver assigned to this category at first level
            category_resolver = CategoryResolver.objects.filter(
                category=complaint.category,
                level=first_level,
                active=True
            ).first()
            
            if category_resolver:
                complaint.assigned_officer = category_resolver.officer
                complaint.current_level = first_level
                complaint.set_escalation_deadline()
                complaint.save()
                
                # Create assignment record
                Assignment.objects.create(
                    complaint=complaint,
                    officer=category_resolver.officer,
                    level=first_level,
                    reason='initial'
                )
                
                return category_resolver.officer
            
            return None
        except Exception as e:
            logger.error(f"Assignment failed: {e}")
            return None
    
    def process_complaint(self, complaint):
        """Full AI processing: categorize, prioritize, and assign"""
        try:
            # Combine title and description for analysis
            complaint_text = f"{complaint.title} {complaint.description}"
            
            # Predict category if not set
            if not complaint.category:
                predicted_category = self.predict_category(complaint_text, complaint.institution)
                if predicted_category:
                    complaint.category = predicted_category
            
            # Predict priority
            predicted_priority = self.predict_priority(complaint_text, complaint.category)
            complaint.priority = predicted_priority
            
            complaint.save()
            
            # Assign to first level officer
            assigned_officer = self.assign_to_first_level_officer(complaint)
            
            return {
                'category': complaint.category,
                'priority': complaint.priority,
                'assigned_officer': assigned_officer
            }
        except Exception as e:
            logger.error(f"Complaint processing failed: {e}")
            return None


# Singleton instance
ai_service = ComplaintAIService()
