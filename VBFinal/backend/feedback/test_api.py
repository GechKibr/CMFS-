#!/usr/bin/env python3
"""
Test script for Feedback API
Run this after starting the Django server to test the feedback functionality
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_feedback_api():
    # First, you need to authenticate and get a token
    # This assumes you have a user account set up
    
    print("=== Feedback API Test ===\n")
    
    # Example: Create a feedback template (requires officer role)
    template_data = {
        "title": "Course Evaluation Form",
        "description": "Please provide feedback about your course experience",
        "fields": [
            {
                "label": "How would you rate this course overall?",
                "field_type": "rating",
                "is_required": True,
                "order": 0,
                "options": []
            },
            {
                "label": "What did you like most about the course?",
                "field_type": "text",
                "is_required": False,
                "order": 1,
                "options": []
            },
            {
                "label": "Which topics were most useful?",
                "field_type": "checkbox",
                "is_required": False,
                "order": 2,
                "options": ["Lectures", "Lab Sessions", "Assignments", "Group Projects"]
            },
            {
                "label": "How likely are you to recommend this course?",
                "field_type": "choice",
                "is_required": True,
                "order": 3,
                "options": ["Very Likely", "Likely", "Neutral", "Unlikely", "Very Unlikely"]
            }
        ]
    }
    
    print("Sample template data:")
    print(json.dumps(template_data, indent=2))
    print("\n" + "="*50 + "\n")
    
    # Example: Submit feedback response
    response_data = {
        "template": "template-uuid-here",  # Replace with actual template UUID
        "answers": [
            {
                "field_id": "field-uuid-1",
                "rating_value": 4
            },
            {
                "field_id": "field-uuid-2", 
                "text_value": "The interactive sessions were excellent"
            },
            {
                "field_id": "field-uuid-3",
                "checkbox_values": ["Lectures", "Lab Sessions"]
            },
            {
                "field_id": "field-uuid-4",
                "choice_value": "Very Likely"
            }
        ]
    }
    
    print("Sample response data:")
    print(json.dumps(response_data, indent=2))
    print("\n" + "="*50 + "\n")
    
    print("API Endpoints:")
    print("POST /api/feedback/templates/ - Create feedback template (Officer only)")
    print("GET /api/feedback/templates/ - List templates")
    print("GET /api/feedback/templates/{id}/ - Get specific template")
    print("POST /api/feedback/templates/{id}/activate/ - Activate template")
    print("POST /api/feedback/templates/{id}/deactivate/ - Deactivate template")
    print("GET /api/feedback/templates/{id}/analytics/ - Get analytics")
    print("POST /api/feedback/responses/ - Submit feedback response")

if __name__ == "__main__":
    test_feedback_api()
