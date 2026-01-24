#!/usr/bin/env python
"""
Test script for category detection debugging
"""
import os
import sys
import django

# Add the backend directory to Python path
sys.path.append('/workspaces/CMFS-/VBFinal/backend')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'conf.settings')
django.setup()

from complaints.ai_service import ai_service
from complaints.models import Category

def test_categorization():
    print("=== Category Detection Test ===")
    
    # Test complaint
    test_text = "there is no water in two weeks"
    print(f"Testing: '{test_text}'")
    print()
    
    # Check available categories
    categories = Category.objects.filter(is_active=True)
    print(f"Available categories ({categories.count()}):")
    for cat in categories:
        print(f"  - {cat.name}: {cat.description}")
    print()
    
    # Test prediction with probabilities
    try:
        category, probabilities = ai_service.predict_category(
            test_text, 
            return_probabilities=True
        )
        
        print("=== Results ===")
        if category:
            print(f"Selected Category: {category.name}")
        else:
            print("No category selected")
        
        print("\nAll probabilities:")
        for cat_name, data in probabilities.items():
            print(f"  {cat_name}:")
            print(f"    Similarity: {data['similarity']:.3f}")
            print(f"    Probability: {data['probability']:.3f}")
            print(f"    Confidence: {data['confidence']:.3f}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_categorization()
