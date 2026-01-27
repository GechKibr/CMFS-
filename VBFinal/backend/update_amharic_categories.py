#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'conf.settings')
django.setup()

from complaints.models import Category

# Amharic translations for categories
amharic_translations = {
    'Academic Affairs': {
        'name': 'የትምህርት ጉዳዮች',
        'description': 'የትምህርት ጥራት፣ ፈተናዎች፣ ውጤት አሰጣጥ፣ የትምህርት ፍትሃዊነት እና የትምህርት ፖሊሲዎችን የሚያካትት'
    },
    'Academic Appeals': {
        'name': 'የትምህርት ይግባኝ',
        'description': 'በትምህርት ውሳኔዎች ላይ የተማሪዎች ይግባኝ ጥያቄዎች'
    },
    'Book & Material Availability': {
        'name': 'የመጽሃፍ እና ቁሳቁስ አቅርቦት',
        'description': 'የጎደሉ መጽሃፎች፣ የተወሰኑ ቅጂዎች እና የዘገዩ ግዢዎች'
    },
    'Cafeteria & Food Services': {
        'name': 'የካፌቴሪያ እና የምግብ አገልግሎት',
        'description': 'የምግብ ጥራት፣ ንፅህና፣ የምግብ አቅርቦት እና የዋጋ ጉዳዮች'
    },
    'Campus Security': {
        'name': 'የካምፓስ ደህንነት',
        'description': 'የደህንነት ሰራተኞች፣ ፓትሮል እና የአደጋ ጊዜ ምላሽ ጉዳዮች'
    },
    'Classroom Facilities': {
        'name': 'የክፍል መገልገያዎች',
        'description': 'የተሰበሩ ወንበሮች፣ ፕሮጄክተሮች፣ መብራት እና የአየር ዝውውር ችግሮች'
    },
    'Course Registration': {
        'name': 'የኮርስ ምዝገባ',
        'description': 'የኮርስ መጨመር/መቀነስ፣ የቅድመ ሁኔታ ማረጋገጥ እና የምዝገባ ስርዓት ስህተቶች'
    },
    'Digital Library Systems': {
        'name': 'የዲጂታል ቤተ-መጽሃፍት ስርዓት',
        'description': 'የኢ-መጽሃፎች፣ ጆርናሎች እና ዳታቤዞች መዳረሻ ችግሮች'
    },
    'Dormitory & Housing': {
        'name': 'የመኝታ ቤት እና መጠለያ',
        'description': 'የተማሪዎች መኖሪያ፣ ብዛት፣ ንፅህና እና ደህንነት ጉዳዮች'
    },
    'Dormitory Maintenance': {
        'name': 'የመኝታ ቤት ጥገና',
        'description': 'በመኝታ ቤቶች ውስጥ የተሰበሩ በሮች፣ መስኮቶች እና አልጋዎች'
    },
    'Electrical & Water Issues': {
        'name': 'የኤሌክትሪክ እና የውሃ ችግሮች',
        'description': 'የኃይል መቋረጥ፣ የውሃ እጥረት እና የቧንቧ ስራ ብልሽቶች'
    },
    'Email & Account Access': {
        'name': 'የኢሜይል እና መለያ መዳረሻ',
        'description': 'የመግቢያ ችግሮች፣ የይለፍ ቃል ዳግም ማስተካከል እና የመለያ ማገድ'
    },
    'Ethics & Discipline': {
        'name': 'የሥነ-ምግባር እና ዲሲፕሊን',
        'description': 'የሥነ-ምግባር ጥሰቶች፣ የዲሲፕሊን እርምጃዎች እና የአካዳሚክ ማጭበርበር'
    },
    'Examination & Grading': {
        'name': 'ፈተና እና ውጤት አሰጣጥ',
        'description': 'የፈተና አስተዳደር፣ የውጤት መለጠፍ እና የውጤት ስህተቶች'
    },
    'Facilities & Maintenance': {
        'name': 'መገልገያዎች እና ጥገና',
        'description': 'የአካላዊ መሠረተ ልማት እና መገልገያዎች እንደ ክፍሎች፣ መኝታ ቤቶች እና ጥገና አገልግሎቶች'
    },
    'Finance & Administration': {
        'name': 'ፋይናንስ እና አስተዳደር',
        'description': 'የገንዘብ ግብይቶች እና የአስተዳደር ሂደቶች እንደ ክፍያዎች፣ ስኮላርሺፖች እና ተመላሾች'
    },
    'Harassment & Misconduct': {
        'name': 'ትንኮሳ እና የተሳሳተ ባህሪ',
        'description': 'የወሲብ ትንኮሳ፣ የቃላት ጥቃት፣ አድልዎ እና ማስፈራሪያ'
    },
    'ICT & Systems': {
        'name': 'የመረጃ ቴክኖሎጂ እና ስርዓቶች',
        'description': 'የኮምፒውተር እና የቴክኖሎጂ ስርዓቶች ችግሮች'
    },
    'Library & Learning Resources': {
        'name': 'ቤተ-መጽሃፍት እና የመማሪያ ግብዓቶች',
        'description': 'የቤተ-መጽሃፍት አገልግሎቶች፣ የመጽሃፍ አቅርቦት እና የጥናት ቦታዎች'
    },
    'Library Access': {
        'name': 'የቤተ-መጽሃፍት መዳረሻ',
        'description': 'የቤተ-መጽሃፍት የመክፈቻ ሰዓቶች፣ ብዛት እና የመቀመጫ አቅርቦት'
    },
    'Network & Internet': {
        'name': 'ኔትወርክ እና ኢንተርኔት',
        'description': 'ዝግተኛ ኢንተርኔት፣ የWi-Fi መቋረጥ እና ያልተረጋጋ ኔትወርክ ግንኙነት'
    },
    'Payments & Refunds': {
        'name': 'ክፍያዎች እና ተመላሾች',
        'description': 'የዘገዩ ክፍያዎች፣ የተሳሳቱ ተመላሾች እና የግብይት ማረጋገጫ ችግሮች'
    },
    'Registrar & Records': {
        'name': 'ምዝገባ እና መዝገቦች',
        'description': 'የግልባጭ ጥያቄዎች፣ የውጤት ሪፖርቶች እና የምዝገባ ማረጋገጫ'
    },
    'Sanitation & Hygiene': {
        'name': 'ንፅህና እና ጤና',
        'description': 'የቆሻሻ አስተዳደር፣ የመጸዳጃ ቤት ንፅህና እና የአካባቢ ጤና ጉዳዮች'
    },
    'Scholarship & Financial Aid': {
        'name': 'ስኮላርሺፕ እና የገንዘብ እርዳታ',
        'description': 'ስኮላርሺፖች፣ አበል፣ አበል እና የተማሪዎች የገንዘብ እርዳታ ፕሮግራሞች'
    },
    'Security & Ethics': {
        'name': 'ደህንነት እና ሥነ-ምግባር',
        'description': 'የካምፓስ ደህንነት፣ ትንኮሳ፣ ስርቆት እና የሥነ-ምግባር ጥሰቶች'
    },
    'Student Counseling': {
        'name': 'የተማሪዎች ምክር',
        'description': 'የስነ-ልቦና፣ ማህበራዊ እና የአካዳሚክ ምክር አገልግሎቶች'
    },
    'Student ID & Cards': {
        'name': 'የተማሪ መታወቂያ እና ካርዶች',
        'description': 'የተማሪ መታወቂያ መስጠት፣ መተካት እና የመዳረሻ ካርዶች'
    },
    'Student Services': {
        'name': 'የተማሪዎች አገልግሎቶች',
        'description': 'ከትምህርት ውጭ የተማሪዎች ድጋፍ አገልግሎቶች እንደ መኖሪያ፣ ካፌቴሪያ እና ምክር'
    },
    'System Security': {
        'name': 'የስርዓት ደህንነት',
        'description': 'የሳይበር ደህንነት ጉዳዮች እንደ ያልተፈቀደ መዳረሻ እና የመረጃ መስረቅ'
    },
    'Teaching & Learning': {
        'name': 'ማስተማር እና መማር',
        'description': 'የማስተማሪያ ዘዴ፣ የአስተማሪ ተገኝነት እና የኮርስ አቅርቦት ጥራት'
    },
    'Theft & Property Loss': {
        'name': 'ስርቆት እና የንብረት ኪሳራ',
        'description': 'የተሰረቁ የግል ዕቃዎች፣ የጠፉ ንብረቶች እና ማበላሸት'
    },
    'Tuition & Fees': {
        'name': 'ክፍያ እና ወጪዎች',
        'description': 'የክፍያ ስሌት ስህተቶች፣ ያልተጠበቁ ክፍያዎች እና የክፍያ ጊዜ ገደቦች'
    },
    'University portal': {
        'name': 'የዩኒቨርሲቲ ፖርታል',
        'description': 'ለምዝገባ፣ ውጤት እና የተማሪ መረጃ ስርዓቶች የሚያገለግሉ የመስመር ላይ ፖርታሎች'
    }
}

# Update categories with Amharic translations
for category in Category.objects.all():
    if category.name in amharic_translations:
        translation = amharic_translations[category.name]
        category.name_amharic = translation['name']
        category.description_amharic = translation['description']
        category.save()
        print(f"Updated: {category.name} -> {category.name_amharic}")

print("All categories updated with Amharic translations!")
