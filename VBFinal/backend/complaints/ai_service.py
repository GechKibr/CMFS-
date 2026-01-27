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
        """Get or compute embeddings for all categories with enhanced context"""
        cache_key = f"category_embeddings_{institution.id if institution else 'all'}"
        embeddings = cache.get(cache_key)
        
        if embeddings is None:
            categories = Category.objects.filter(is_active=True)
            if institution:
                categories = categories.filter(models.Q(institution=institution) | models.Q(institution__isnull=True))
            
            if not categories.exists():
                return {}, []
            
            # Enhanced text representations with more context
            category_texts = []
            category_ids = []
            
            for cat in categories:
                # Build richer context
                context_parts = [cat.name]
                
                if cat.description:
                    context_parts.append(cat.description)
                
                # Add parent category context
                if cat.parent:
                    context_parts.append(f"subcategory of {cat.parent.name}")
                
                # Add related keywords from historical complaints
                keywords = self._get_category_keywords(cat)
                if keywords:
                    context_parts.append(" ".join(keywords))
                
                text = " ".join(context_parts)
                category_texts.append(text)
                category_ids.append(cat.category_id)
            
            # Generate embeddings
            if self.model:
                embeddings_array = self.model.encode(category_texts)
                embeddings = {
                    'ids': category_ids,
                    'embeddings': embeddings_array
                }
                # Cache for 30 minutes (shorter for more frequent updates)
                cache.set(cache_key, embeddings, 1800)
            else:
                return {}, []
        
        return embeddings.get('ids', []), embeddings.get('embeddings', [])
    
    def _get_category_keywords(self, category, limit=10):
        """Extract common keywords from complaints in this category"""
        try:
            # Get recent complaints in this category
            complaints = Complaint.objects.filter(
                category=category,
                status__in=['resolved', 'in_progress']
            ).order_by('-created_at')[:50]
            
            if not complaints.exists():
                return []
            
            # Simple keyword extraction (could be enhanced with TF-IDF)
            from collections import Counter
            import re
            
            all_words = []
            for complaint in complaints:
                text = f"{complaint.title} {complaint.description}".lower()
                words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
                all_words.extend(words)
            
            # Filter common stop words
            stop_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'}
            
            filtered_words = [word for word in all_words if word not in stop_words and len(word) > 3]
            
            # Get most common words
            word_counts = Counter(filtered_words)
            return [word for word, count in word_counts.most_common(limit)]
            
        except Exception as e:
            logger.error(f"Keyword extraction failed: {e}")
            return []
    
    def predict_category(self, complaint_text, institution=None, return_probabilities=False):
        """Predict the best matching category with enhanced similarity scoring"""
        if not self.model:
            logger.warning("AI model not loaded")
            return None if not return_probabilities else (None, {})
        
        try:
            # Get category embeddings
            category_ids, category_embeddings = self.get_category_embeddings(institution)
            
            if not category_ids:
                logger.warning("No categories found for prediction")
                return None if not return_probabilities else (None, {})
            
            # Enhanced text preprocessing
            complaint_text = self._preprocess_text(complaint_text)
            logger.info(f"Processing complaint text: '{complaint_text}'")
            
            # Encode complaint with multiple representations
            complaint_embedding = self.model.encode([complaint_text])
            
            # Calculate similarities
            similarities = cosine_similarity(complaint_embedding, category_embeddings)[0]
            
            # Debug: Log all similarities
            for i, (cat_id, similarity) in enumerate(zip(category_ids, similarities)):
                try:
                    category = Category.objects.get(category_id=cat_id)
                    logger.info(f"Category '{category.name}': similarity={similarity:.3f}")
                except Category.DoesNotExist:
                    continue
            
            # Apply softmax for probability distribution
            probabilities = self._softmax(similarities)
            
            # Get top matches with confidence scores
            sorted_indices = np.argsort(similarities)[::-1]
            top_matches = []
            
            for i in range(min(5, len(sorted_indices))):  # Top 5 matches for debugging
                idx = sorted_indices[i]
                category_id = category_ids[idx]
                similarity = similarities[idx]
                probability = probabilities[idx]
                
                top_matches.append({
                    'category_id': category_id,
                    'similarity': float(similarity),
                    'probability': float(probability),
                    'confidence': self._calculate_confidence(similarity, probabilities)
                })
            
            # Enhanced threshold with dynamic adjustment
            best_match = top_matches[0]
            threshold = self._get_dynamic_threshold(best_match, top_matches)
            
            logger.info(f"Best match: similarity={best_match['similarity']:.3f}, threshold={threshold:.3f}")
            
            if return_probabilities:
                category_probs = {}
                for match in top_matches:
                    try:
                        category = Category.objects.get(category_id=match['category_id'])
                        category_probs[category.name] = {
                            'probability': match['probability'],
                            'similarity': match['similarity'],
                            'confidence': match['confidence']
                        }
                    except Category.DoesNotExist:
                        continue
                
                best_category = None
                if best_match['similarity'] > threshold:
                    best_category = Category.objects.get(category_id=best_match['category_id'])
                    logger.info(f"Selected category: {best_category.name}")
                else:
                    logger.warning(f"No category selected - best similarity {best_match['similarity']:.3f} below threshold {threshold:.3f}")
                
                return best_category, category_probs
            
            # Return best match if above threshold
            if best_match['similarity'] > threshold:
                category = Category.objects.get(category_id=best_match['category_id'])
                logger.info(f"Selected category: {category.name}")
                return category
            else:
                logger.warning(f"No category selected - best similarity {best_match['similarity']:.3f} below threshold {threshold:.3f}")
            
            return None
            
        except Exception as e:
            logger.error(f"Category prediction failed: {e}")
            return None if not return_probabilities else (None, {})
    
    def _preprocess_text(self, text):
        """Enhanced text preprocessing for better embeddings"""
        import re
        
        # Clean and normalize text
        text = text.lower().strip()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Expand common abbreviations and add synonyms
        abbreviations = {
            'prof': 'professor',
            'dept': 'department',
            'admin': 'administration',
            'mgmt': 'management',
            'hr': 'human resources',
            'it': 'information technology',
            'ac': 'air conditioning',
            'wifi': 'internet connection',
            'lab': 'laboratory'
        }
        
        # Add water-related synonyms for better matching
        water_synonyms = {
            'no water': 'water shortage water supply water problem',
            'water issue': 'water problem water shortage',
            'water supply': 'water availability water access',
            'water shortage': 'no water water problem water crisis'
        }
        
        # Apply water synonyms first
        for phrase, expansion in water_synonyms.items():
            if phrase in text:
                text = text.replace(phrase, f"{phrase} {expansion}")
        
        # Apply abbreviations
        for abbr, full in abbreviations.items():
            text = re.sub(r'\b' + abbr + r'\b', full, text)
        
        return text
    
    def _softmax(self, x):
        """Apply softmax to convert similarities to probabilities"""
        exp_x = np.exp(x - np.max(x))  # Subtract max for numerical stability
        return exp_x / np.sum(exp_x)
    
    def _calculate_confidence(self, similarity, probabilities):
        """Calculate confidence score based on similarity and probability distribution"""
        # Higher confidence when:
        # 1. High similarity score
        # 2. Clear winner (high probability gap)
        max_prob = np.max(probabilities)
        second_max_prob = np.partition(probabilities, -2)[-2]
        prob_gap = max_prob - second_max_prob
        
        # Combine similarity and probability gap
        confidence = (similarity * 0.7) + (prob_gap * 0.3)
        return min(confidence, 1.0)
    
    def _get_dynamic_threshold(self, best_match, top_matches):
        """Dynamic threshold based on match quality and distribution"""
        base_threshold = 0.25  # Lowered from 0.45 for better detection
        
        # Lower threshold if there's a clear winner
        if len(top_matches) >= 2:
            gap = best_match['similarity'] - top_matches[1]['similarity']
            if gap > 0.15:  # Clear winner (lowered from 0.2)
                base_threshold = 0.20
        
        # Adjust based on confidence
        confidence_adjustment = (best_match['confidence'] - 0.5) * 0.05  # Reduced adjustment
        
        return max(0.15, base_threshold + confidence_adjustment)  # Minimum threshold lowered
    
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
        """Full AI processing with enhanced categorization and probability tracking"""
        try:
            # Combine title and description for analysis
            complaint_text = f"{complaint.title} {complaint.description}"
            
            # Predict category with probabilities if not set
            if not complaint.category:
                predicted_category, category_probabilities = self.predict_category(
                    complaint_text, 
                    complaint.institution, 
                    return_probabilities=True
                )
                
                if predicted_category:
                    complaint.category = predicted_category
                    
                    # Log prediction confidence for learning
                    logger.info(f"Category prediction for complaint {complaint.complaint_id}: "
                              f"{predicted_category.name} with probabilities: {category_probabilities}")
            
            # Predict priority
            predicted_priority = self.predict_priority(complaint_text, complaint.category)
            complaint.priority = predicted_priority
            
            complaint.save()
            
            # Assign to first level officer
            assigned_officer = self.assign_to_first_level_officer(complaint)
            
            return {
                'category': complaint.category,
                'priority': complaint.priority,
                'assigned_officer': assigned_officer,
                'category_probabilities': category_probabilities if 'category_probabilities' in locals() else {}
            }
        except Exception as e:
            logger.error(f"Complaint processing failed: {e}")
            return None
    
    def get_category_suggestions(self, complaint_text, institution=None, top_n=5):
        """Get top N category suggestions with confidence scores"""
        try:
            category, probabilities = self.predict_category(
                complaint_text, 
                institution, 
                return_probabilities=True
            )
            
            # Sort by probability
            sorted_suggestions = sorted(
                probabilities.items(), 
                key=lambda x: x[1]['probability'], 
                reverse=True
            )[:top_n]
            
            return [{
                'category_name': name,
                'probability': data['probability'],
                'similarity': data['similarity'],
                'confidence': data['confidence']
            } for name, data in sorted_suggestions]
            
        except Exception as e:
            logger.error(f"Category suggestions failed: {e}")
            return []


# Singleton instance
ai_service = ComplaintAIService()
