import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const SubmitComplaint = ({ setSubmitSuccess, onComplaintSubmitted }) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [complaintForm, setComplaintForm] = useState({
    title: '',
    description: '',
    category: '',
    isAnonymous: false,
  });
  const [categorySearchText, setCategorySearchText] = useState('');
  const [categoryRegexEnabled, setCategoryRegexEnabled] = useState(false);
  const [resolverFilters, setResolverFilters] = useState({
    campus: '',
    college: '',
    department: '',
  });
  const [files, setFiles] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedResolverIds, setSelectedResolverIds] = useState([]);
  const [resolverSelectionValue, setResolverSelectionValue] = useState('');
  const [resolverOfficerIds, setResolverOfficerIds] = useState([]);
  const [ccSearchText, setCcSearchText] = useState('');
  const [ccRegexEnabled, setCcRegexEnabled] = useState(false);
  const [ccFilters, setCcFilters] = useState({
    campus: '',
    college: '',
    department: '',
  });
  const [ccOfficerIds, setCcOfficerIds] = useState([]);
  const [submitSuccess, setLocalSubmitSuccess] = useState(false);
  const totalSteps = 5; // Changed to 5 steps - Category, Details, Attachments, Review, Submit

  const userScope = useMemo(() => {
    const studentProfile = user?.student_profile || {};
    const departmentDetail = studentProfile.department_detail || {};

    return {
      campus: String(user?.user_campus || studentProfile.campus_id || user?.campus_id || ''),
      college: String(user?.college || departmentDetail.department_college || studentProfile.college || ''),
      department: String(user?.department || studentProfile.department || ''),
    };
  }, [user]);

  const resolverMatchesComplaintScope = useCallback((resolver) => {
    if (!resolver) return false;
    if (resolver.department && userScope.department) {
      return String(resolver.department) === String(userScope.department);
    }
    if (resolver.college && userScope.college) {
      return String(resolver.college) === String(userScope.college);
    }
    if (resolver.campus && userScope.campus) {
      return String(resolver.campus) === String(userScope.campus);
    }
    return true;
  }, [userScope]);

  const getCategoryId = (category) => String(category.category_id || category.id || '');

  const buildCategoryLabel = useCallback((category, map, visited = new Set()) => {
    const categoryId = getCategoryId(category);
    if (!categoryId || visited.has(categoryId)) {
      return category.name || category.office_name || category.category_id;
    }

    visited.add(categoryId);
    const parentId = String(category.parent || '');
    const currentName = category.name || category.office_name || category.category_id;
    if (!parentId || !map[parentId]) {
      return currentName;
    }

    const parentLabel = buildCategoryLabel(map[parentId], map, visited);
    return `${parentLabel} > ${currentName}`;
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const [categoriesResponse, resolverData] = await Promise.all([
        apiService.getAllCategories(),
        apiService.getAllCategoryResolvers()
      ]);

      const rawCategories = (categoriesResponse?.results || categoriesResponse || [])
        .filter((item) => item && item.is_active !== false);
      const categoryMap = rawCategories.reduce((acc, item) => {
        acc[String(item.category_id || item.id)] = item;
        return acc;
      }, {});

      const categoryOptions = rawCategories
        .map((item) => ({
          ...item,
          label: buildCategoryLabel(item, categoryMap),
          value: getCategoryId(item),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setCategories(categoryOptions);

      const normalizedResolvers = (resolverData?.results || resolverData || []).map((resolver) => {
        const firstOfficer = resolver.officers && resolver.officers.length > 0 ? resolver.officers[0] : null;
        const officerId = firstOfficer?.id || resolver.officer_id || null;
        const officerName = firstOfficer ? `${firstOfficer.first_name} ${firstOfficer.last_name}`.trim() || firstOfficer.email : (resolver.officer_name || '');

        return {
          ...resolver,
          id: resolver.resolver_id || resolver.id,
          officer_id: officerId,
          officer_name: officerName || resolver.scope_label || 'Resolver route',
          scope_label: resolver.scope_label || resolver.category_name || 'Resolver route',
          campus_name: resolver.campus_name || '',
          college_name: resolver.college_name || '',
          department_name: resolver.department_name || '',
          officers: resolver.officers || [],
        };
      });
      setCategoryResolvers(normalizedResolvers);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [buildCategoryLabel]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const validateForm = useCallback(() => {
    const errors = {};
    if (!complaintForm.title.trim()) errors.title = t('required');
    if (!complaintForm.description.trim()) errors.description = t('required');
    if (!complaintForm.category) errors.category = t('required');
    if (complaintForm.description.length > 500) {
      errors.description = 'Description must be under 500 characters';
    }
    setFormErrors(errors);
    return errors;
  }, [complaintForm.title, complaintForm.description, complaintForm.category, t]);

  const clearForm = () => {
    setComplaintForm({ title: '', description: '', category: '', isAnonymous: false });
    setFiles([]);
    setSelectedResolverIds([]);
    setResolverSelectionValue('');
    setResolverOfficerIds([]);
    setCategorySearchText('');
    setCategoryRegexEnabled(false);
    setResolverFilters({ campus: '', college: '', department: '' });
    setCcSearchText('');
    setCcRegexEnabled(false);
    setCcFilters({ campus: '', college: '', department: '' });
    setCcOfficerIds([]);
    setFormErrors({});
    setCurrentStep(1);
  };

  const selectedCategory = categories.find((item) => String(item.value) === String(complaintForm.category));

  const selectedCategoryResolvers = useMemo(() => {
    const priority = (resolver) => {
      if (resolver.department_name) return 3;
      if (resolver.college_name) return 2;
      if (resolver.campus_name) return 1;
      return 0;
    };

    return categoryResolvers
      .filter((resolver) => String(resolver.category) === String(complaintForm.category) && resolver.active)
      .sort((a, b) => priority(b) - priority(a) || String(a.scope_label || '').localeCompare(String(b.scope_label || '')) || String(a.officer_name || '').localeCompare(String(b.officer_name || '')));
  }, [categoryResolvers, complaintForm.category]);

  const complaintScopedResolvers = useMemo(() => (
    selectedCategoryResolvers.filter(resolverMatchesComplaintScope)
  ), [selectedCategoryResolvers, resolverMatchesComplaintScope]);

  useEffect(() => {
    if (
      resolverFilters.campus &&
      resolverFilters.college &&
      resolverFilters.department &&
      selectedCategoryResolvers.length > 0
    ) {
      const matchingOfficers = selectedCategoryResolvers.filter((resolver) => {
        return (
          resolver.campus_name === resolverFilters.campus &&
          resolver.college_name === resolverFilters.college &&
          resolver.department_name === resolverFilters.department
        );
      });

      if (matchingOfficers.length > 0) {
        const officerIds = matchingOfficers.map((resolver) => String(resolver.id));
        setSelectedResolverIds(officerIds);
        setResolverSelectionValue('');
      }
    }
  }, [resolverFilters.campus, resolverFilters.college, resolverFilters.department, selectedCategoryResolvers]);

  const selectCategory = (categoryValue) => {
    setComplaintForm((prev) => ({ ...prev, category: categoryValue }));
    setResolverFilters({ campus: '', college: '', department: '' });
    setSelectedResolverIds([]);
    setResolverSelectionValue('');
    setResolverOfficerIds([]);
  };

  const buildSearchMatcher = useCallback((query, useRegex, invalidRegexMessage) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return { matcher: () => true, error: '' };
    }

    if (useRegex) {
      try {
        const regex = new RegExp(trimmed, 'i');
        return { matcher: (text) => regex.test(text), error: '' };
      } catch {
        return { matcher: () => false, error: invalidRegexMessage };
      }
    }

    const lowered = trimmed.toLowerCase();
    return { matcher: (text) => String(text || '').toLowerCase().includes(lowered), error: '' };
  }, []);

  const categorySearch = useMemo(() => buildSearchMatcher(
    categorySearchText,
    categoryRegexEnabled,
    'Enter a valid regex pattern.'
  ), [buildSearchMatcher, categorySearchText, categoryRegexEnabled]);

  const ccOfficeSearch = useMemo(() => buildSearchMatcher(
    ccSearchText,
    ccRegexEnabled,
    'Enter a valid regex pattern.'
  ), [buildSearchMatcher, ccSearchText, ccRegexEnabled]);

  const toSearchableText = useCallback((category) => (
    [
      category?.label,
      category?.officer_name,
      category?.scope_label,
      category?.campus_name,
      category?.college_name,
      category?.department_name,
      category?.office_name,
      category?.office_description,
    ]
      .filter(Boolean)
      .join(' ')
  ), []);

  const filteredCategories = useMemo(() => (
    categories.filter((category) => categorySearch.matcher(toSearchableText(category)))
  ), [categories, categorySearch, toSearchableText]);

  const resolverCampusOptions = useMemo(() => (
    Array.from(new Set(selectedCategoryResolvers.map((resolver) => resolver.campus_name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [selectedCategoryResolvers]);

  const resolverCollegeOptions = useMemo(() => (
    Array.from(new Set(selectedCategoryResolvers
      .filter((resolver) => !resolverFilters.campus || resolver.campus_name === resolverFilters.campus)
      .map((resolver) => resolver.college_name)
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [selectedCategoryResolvers, resolverFilters.campus]);

  const resolverDepartmentOptions = useMemo(() => (
    Array.from(new Set(selectedCategoryResolvers
      .filter((resolver) => (!resolverFilters.campus || resolver.campus_name === resolverFilters.campus)
        && (!resolverFilters.college || resolver.college_name === resolverFilters.college))
      .map((resolver) => resolver.department_name)
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [selectedCategoryResolvers, resolverFilters.campus, resolverFilters.college]);

  const filteredCcResolvers = useMemo(() => (
    selectedCategoryResolvers.filter((resolver) => {
      if (ccFilters.campus && resolver.campus_name !== ccFilters.campus) return false;
      if (ccFilters.college && resolver.college_name !== ccFilters.college) return false;
      if (ccFilters.department && resolver.department_name !== ccFilters.department) return false;
      return true;
    })
  ), [selectedCategoryResolvers, ccFilters]);

  const ccCampusOptions = useMemo(() => (
    Array.from(new Set(filteredCcResolvers.map((resolver) => resolver.campus_name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [filteredCcResolvers]);

  const ccCollegeOptions = useMemo(() => (
    Array.from(new Set(filteredCcResolvers
      .filter((resolver) => !ccFilters.campus || resolver.campus_name === ccFilters.campus)
      .map((resolver) => resolver.college_name)
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [filteredCcResolvers, ccFilters.campus]);

  const ccDepartmentOptions = useMemo(() => (
    Array.from(new Set(filteredCcResolvers
      .filter((resolver) => (!ccFilters.campus || resolver.campus_name === ccFilters.campus)
        && (!ccFilters.college || resolver.college_name === ccFilters.college))
      .map((resolver) => resolver.department_name)
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [filteredCcResolvers, ccFilters.campus, ccFilters.college]);

  const filteredResolverOfficers = useMemo(() => (
    complaintScopedResolvers.filter((resolver) => {
      if (resolverFilters.campus && resolver.campus_name !== resolverFilters.campus) return false;
      if (resolverFilters.college && resolver.college_name !== resolverFilters.college) return false;
      if (resolverFilters.department && resolver.department_name !== resolverFilters.department) return false;
      return true;
    })
  ), [complaintScopedResolvers, resolverFilters]);

  const selectedResolverRoutes = useMemo(() => (
    selectedResolverIds
      .map((resolverId) => selectedCategoryResolvers.find((resolver) => String(resolver.id) === String(resolverId)))
      .filter((resolver) => Boolean(resolver) && resolverMatchesComplaintScope(resolver))
  ), [selectedResolverIds, selectedCategoryResolvers, resolverMatchesComplaintScope]);

  const availableResolverRoutes = useMemo(() => (
    filteredResolverOfficers.filter((resolver) => !selectedResolverIds.includes(String(resolver.id)))
  ), [filteredResolverOfficers, selectedResolverIds]);

  useEffect(() => {
    if (!complaintScopedResolvers.length) return;

    const defaultCampus = complaintScopedResolvers.find((resolver) => resolver.campus_name)?.campus_name || '';
    const defaultCollege = complaintScopedResolvers.find((resolver) => resolver.college_name)?.college_name || '';
    const defaultDepartment = complaintScopedResolvers.find((resolver) => resolver.department_name)?.department_name || '';

    setResolverFilters((prev) => ({
      campus: prev.campus || defaultCampus,
      college: prev.college || defaultCollege,
      department: prev.department || defaultDepartment,
    }));
  }, [complaintScopedResolvers]);

  useEffect(() => {
    if (!selectedResolverIds.length) return;
    const validResolverIds = new Set(complaintScopedResolvers.map((resolver) => String(resolver.id)));
    const nextSelected = selectedResolverIds.filter((resolverId) => validResolverIds.has(String(resolverId)));
    if (nextSelected.length !== selectedResolverIds.length) {
      setSelectedResolverIds(nextSelected);
      setFormErrors((prev) => ({
        ...prev,
        resolver_ids: 'Some selected resolvers do not match your complaint scope and were removed.',
      }));
    }
  }, [complaintScopedResolvers, selectedResolverIds]);

  useEffect(() => {
    const officerIds = Array.from(new Set(selectedResolverRoutes.map((resolver) => String(resolver.officer_id || resolver.officer)).filter(Boolean)));
    setResolverOfficerIds(officerIds);
  }, [selectedResolverRoutes]);

  const selectedCcOfficers = useMemo(() => (
    ccOfficerIds
      .map((resolverId) => selectedCategoryResolvers.find((resolver) => String(resolver.id) === String(resolverId)))
      .filter(Boolean)
  ), [ccOfficerIds, selectedCategoryResolvers]);

  const availableCcOfficers = useMemo(() => (
    filteredCcResolvers.filter((resolver) => !ccOfficerIds.includes(String(resolver.id)))
  ), [filteredCcResolvers, ccOfficerIds]);

  const getComplaintScopeFromSelection = useCallback(() => {
    const resolvedScope = selectedCategoryResolvers.find((resolver) => {
      if (resolverFilters.campus && resolver.campus_name !== resolverFilters.campus) return false;
      if (resolverFilters.college && resolver.college_name !== resolverFilters.college) return false;
      if (resolverFilters.department && resolver.department_name !== resolverFilters.department) return false;
      return true;
    });

    if (resolvedScope) {
      return {
        campus: resolvedScope.campus || '',
        college: resolvedScope.college || '',
        department: resolvedScope.department || '',
      };
    }

    if (selectedResolverIds.length > 0) {
      const selectedResolver = selectedCategoryResolvers.find((resolver) => selectedResolverIds.includes(String(resolver.id)));
      if (selectedResolver) {
        return {
          campus: selectedResolver.campus || '',
          college: selectedResolver.college || '',
          department: selectedResolver.department || '',
        };
      }
    }

    return { campus: '', college: '', department: '' };
  }, [resolverFilters, selectedCategoryResolvers, selectedResolverIds]);

  const validateStep = (step) => {
    if (step === 1) {
      return !!complaintForm.category;
    }
    if (step === 2) {
      const errors = validateForm();
      return !errors.title && !errors.description;
    }
    if (step === 3) {
      return true; // Attachments optional
    }
    if (step === 4) {
      return true; // Review step - just displays info
    }
    return true;
  };

  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 5 * 1024 * 1024;
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      alert('Some files were rejected. Only images, PDFs, and documents under 5MB are allowed.');
    }

    setFiles(prev => [...prev, ...validFiles].slice(0, 5));
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addResolverRouteSelection = () => {
    if (!resolverSelectionValue) return;
    setSelectedResolverIds((prev) => (
      prev.includes(String(resolverSelectionValue))
        ? prev
        : [...prev, String(resolverSelectionValue)]
    ));
    setResolverSelectionValue('');
  };

  const removeResolverRouteSelection = (resolverId) => {
    setSelectedResolverIds((prev) => prev.filter((item) => String(item) !== String(resolverId)));
  };

  const clearResolverRouteSelections = () => {
    setSelectedResolverIds([]);
    setResolverSelectionValue('');
  };

  const selectAllResolverRoutes = () => {
    setSelectedResolverIds(filteredResolverOfficers.map((resolver) => String(resolver.id)));
    setResolverSelectionValue('');
  };

  const addCcOfficerSelection = (resolverId) => {
    if (!resolverId) return;
    setCcOfficerIds((prev) => (
      prev.includes(String(resolverId))
        ? prev
        : [...prev, String(resolverId)]
    ));
  };

  const removeCcOfficerSelection = (resolverId) => {
    setCcOfficerIds((prev) => prev.filter((item) => String(item) !== String(resolverId)));
  };

  const clearCcOfficerSelections = () => {
    setCcOfficerIds([]);
  };

  const selectAllCcOfficers = () => {
    setCcOfficerIds(filteredCcResolvers.map((resolver) => String(resolver.id)));
  };

  const submitComplaint = async () => {
    const errors = validateForm();
    if (selectedResolverIds.length > 0 && selectedResolverRoutes.length === 0) {
      errors.resolver_ids = 'Please select CategoryResolver routes that match your complaint scope.';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', complaintForm.title);
      formData.append('description', complaintForm.description);
      formData.append('category', complaintForm.category);
      formData.append('is_anonymous', complaintForm.isAnonymous ? 'true' : 'false');

      const selectedScope = getComplaintScopeFromSelection();
      if (selectedScope.campus) formData.append('campus', selectedScope.campus);
      if (selectedScope.college) formData.append('college', selectedScope.college);
      if (selectedScope.department) formData.append('department', selectedScope.department);

      if (ccOfficerIds.length > 0) {
        const ccOfficerNumbers = ccOfficerIds
          .map((id) => {
            const resolver = selectedCategoryResolvers.find((resolver) => String(resolver.id) === String(id));
            if (!resolver) return null;
            return resolver.officer_id || (resolver.officers && resolver.officers[0]?.id);
          })
          .filter(Boolean)
          .map(Number);

        if (ccOfficerNumbers.length > 0) {
          ccOfficerNumbers.forEach((officerId) => {
            formData.append('cc_officer_ids', String(officerId));
          });
        }
      }

      if (resolverOfficerIds.length > 0) {
        resolverOfficerIds.forEach((officerId) => {
          formData.append('resolver_officer_ids', String(Number(officerId)));
        });
      }
      if (selectedResolverIds.length > 0) {
        selectedResolverIds.forEach((id) => {
          formData.append('resolver_ids', String(id));
        });
      }
      files.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await apiService.createComplaint(formData);

      if (response) {
        clearForm();
        setLocalSubmitSuccess(true);
        if (setSubmitSuccess) setSubmitSuccess(true);
        if (onComplaintSubmitted) onComplaintSubmitted();
        setTimeout(() => {
          setLocalSubmitSuccess(false);
          if (setSubmitSuccess) setSubmitSuccess(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      alert('Failed to submit complaint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf') return '📄';
    if (file.type.includes('word')) return '📝';
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const steps = [
    { number: 1, title: 'Category', icon: '📋', description: 'Select type & assign' },
    { number: 2, title: 'Details', icon: '✏️', description: 'Title & description' },
    { number: 3, title: 'Attachments', icon: '📎', description: 'Upload files' },
    { number: 4, title: 'Review', icon: '👁️', description: 'Check information' },
    { number: 5, title: 'Submit', icon: '🚀', description: 'Final submission' }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Success Toast */}
      {submitSuccess && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Complaint Submitted!</p>
              <p className="text-sm opacity-90">Your complaint has been successfully submitted</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className={`${isDark ? 'bg-gray-800/90 backdrop-blur-sm' : 'bg-white'} rounded-2xl shadow-2xl border ${isDark ? 'border-gray-700' : 'border-gray-100'} overflow-hidden`}>

        {/* Header */}
        <div className={`relative overflow-hidden px-6 sm:px-8 py-6 border-b ${isDark ? 'border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750' : 'border-gray-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50'}`}>
          <div className="absolute top-0 right-0 w-72 h-72 opacity-5">
            <svg className="w-full h-full" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M100 0L200 100L100 200L0 100L100 0Z" fill="currentColor" />
            </svg>
          </div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Submit New Complaint
                  </h3>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Complete all steps to submit your complaint
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearForm}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Reset Form
              </button>
            </div>
          </div>
        </div>

        {/* Step Progress Indicator */}
        <div className="px-6 sm:px-8 pt-8 pb-4">
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700"></div>
            <div className="relative flex justify-between">
              {steps.map((step) => (
                <div key={step.number} className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 z-10
                      ${currentStep > step.number
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                        : currentStep === step.number
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg scale-110 ring-4 ring-blue-500/20'
                          : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                      }
                    `}
                  >
                    {currentStep > step.number ? '✓' : step.icon}
                  </div>
                  <p className={`text-xs font-medium mt-2 ${currentStep === step.number ? 'text-blue-600 dark:text-blue-400' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {step.title}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'} hidden sm:block text-center`}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* STEP 1: CATEGORY & RESOLVERS & CC */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              {/* Category Selection */}
              <div>
                <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                  Select Complaint Category <span className="text-red-500">*</span>
                </label>

                <div className="mb-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          value={categorySearchText}
                          onChange={(e) => setCategorySearchText(e.target.value)}
                          placeholder="Search by category name or description..."
                          className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'}`}
                        />
                      </div>
                    </div>
                    <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <input
                        type="checkbox"
                        checked={categoryRegexEnabled}
                        onChange={(e) => setCategoryRegexEnabled(e.target.checked)}
                        className="rounded"
                      />
                      Search
                    </label>
                  </div>
                </div>

                <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'} ${formErrors.category ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredCategories.map((cat) => {
                      const isSelected = String(complaintForm.category) === String(cat.value);
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => selectCategory(cat.value)}
                          className={`w-full text-left px-4 py-3 transition-all duration-200 group ${isSelected ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-l-blue-500' : isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {cat.name || cat.office_name}
                              </p>
                              {cat.office_description && (
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {cat.office_description}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md ml-3">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formErrors.category && <p className="text-red-500 text-sm mt-2">{formErrors.category}</p>}

                {/* Anonymous Option */}
                {selectedCategory && (
                  <div className="mt-6">
                    <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isDark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={complaintForm.isAnonymous}
                        onChange={(e) => setComplaintForm({ ...complaintForm, isAnonymous: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded"
                      />
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          Submit Anonymously
                        </p>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Your identity will be hidden from officers but preserved for audit purposes
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Resolvers Section */}
                {selectedCategory && selectedCategoryResolvers.length > 0 && (
                  <div className={`mt-6 rounded-xl border p-5 ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Select office</h4>
                        {/* <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Select officers who should handle this complaint</p> */}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={selectAllResolverRoutes} className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>Select All</button>
                        <button type="button" onClick={clearResolverRouteSelections} className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Clear</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <select value={resolverFilters.campus} onChange={(e) => setResolverFilters(prev => ({ ...prev, campus: e.target.value, college: '', department: '' }))} className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                        <option value="">All Campuses</option>
                        {resolverCampusOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={resolverFilters.college} onChange={(e) => setResolverFilters(prev => ({ ...prev, college: e.target.value, department: '' }))} className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                        <option value="">All Colleges</option>
                        {resolverCollegeOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={resolverFilters.department} onChange={(e) => setResolverFilters(prev => ({ ...prev, department: e.target.value }))} className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                        <option value="">All Departments</option>
                        {resolverDepartmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <select value={resolverSelectionValue} onChange={(e) => setResolverSelectionValue(e.target.value)} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                        <option value="">Select a resolver...</option>
                        {availableResolverRoutes.map(r => <option key={r.id} value={r.id}>{r.officer_name} - {r.scope_label}</option>)}
                      </select>
                      <button type="button" onClick={addResolverRouteSelection} disabled={!resolverSelectionValue} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Add</button>
                    </div>

                    {selectedResolverRoutes.length > 0 && (
                      <div>
                        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Selected ({selectedResolverRoutes.length})</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedResolverRoutes.map(r => (
                            <div key={r.id} className={`flex justify-between items-center p-2 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                              <div><p className="text-sm font-medium">{r.officer_name}</p><p className="text-xs opacity-70">{r.scope_label}</p></div>
                              <button type="button" onClick={() => removeResolverRouteSelection(r.id)} className="text-red-500 text-xs">Remove</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CC Section */}
                {selectedCategory && selectedCategoryResolvers.length > 0 && (
                  <div className={`rounded-xl border p-5 ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div><h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>CC Recipients</h4><p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Select officers to receive a copy</p></div>
                      <div className="flex gap-2">
                        <button type="button" onClick={selectAllCcOfficers} className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>Select All</button>
                        <button type="button" onClick={clearCcOfficerSelections} className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Clear</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <select value={ccFilters.campus} onChange={(e) => setCcFilters(prev => ({ ...prev, campus: e.target.value, college: '', department: '' }))} className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                        <option value="">All Campuses</option>
                        {ccCampusOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={ccFilters.college} onChange={(e) => setCcFilters(prev => ({ ...prev, college: e.target.value, department: '' }))} className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                        <option value="">All Colleges</option>
                        {ccCollegeOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={ccFilters.department} onChange={(e) => setCcFilters(prev => ({ ...prev, department: e.target.value }))} className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                        <option value="">All Departments</option>
                        {ccDepartmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input type="text" value={ccSearchText} onChange={(e) => setCcSearchText(e.target.value)} placeholder="Search CC recipients..." className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`} />
                      </div>
                      <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <input type="checkbox" checked={ccRegexEnabled} onChange={(e) => setCcRegexEnabled(e.target.checked)} className="rounded" /> Search
                      </label>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-2 mb-4">
                      {availableCcOfficers.filter(r => ccOfficeSearch.matcher(toSearchableText(r))).map(r => (
                        <button key={r.id} type="button" onClick={() => addCcOfficerSelection(r.id)} className={`w-full text-left p-2 rounded-lg border transition-all ${isDark ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                          <p className="text-sm font-medium">{r.officer_name}</p>
                          <p className="text-xs opacity-70">{r.scope_label}</p>
                        </button>
                      ))}
                    </div>

                    {selectedCcOfficers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedCcOfficers.map(r => (
                          <div key={r.id} className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${isDark ? 'bg-gray-600' : 'bg-blue-100'}`}>
                            <span>{r.officer_name}</span>
                            <button type="button" onClick={() => removeCcOfficerSelection(r.id)} className="hover:text-red-500">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: COMPLAINT DETAILS */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Title <span className="text-red-500">*</span></label>
                <input type="text" value={complaintForm.title} onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })} className={`w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'} ${formErrors.title ? 'border-red-500' : ''}`} placeholder="Enter a clear title" />
                {formErrors.title && <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description <span className="text-red-500">*</span></label>
                <textarea value={complaintForm.description} onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })} rows={6} className={`w-full rounded-xl border px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 resize-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'} ${formErrors.description ? 'border-red-500' : ''}`} placeholder="Provide detailed description..." />
                <div className="flex justify-end mt-1"><p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{complaintForm.description.length}/500 characters</p></div>
              </div>
            </div>
          )}

          {/* STEP 3: ATTACHMENTS */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all hover:border-blue-400 ${isDark ? 'border-gray-600 bg-gray-700/20' : 'border-gray-300 bg-gray-50'}`}>
                <input type="file" multiple onChange={handleFileChange} className="hidden" id="file-upload" accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.doc,.docx" />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Click to upload files</p>
                  <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Images, PDFs, Documents (Max 5 files, 5MB each)</p>
                </label>
              </div>
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className={`flex justify-between items-center p-3 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-3"><span className="text-2xl">{getFileIcon(file)}</span><div><p className="text-sm font-medium">{file.name}</p><p className="text-xs opacity-70">{formatFileSize(file.size)}</p></div></div>
                      <button type="button" onClick={() => removeFile(i)} className="text-red-500">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: REVIEW - Separate step, no submit button here */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className={`px-6 py-4 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} border-b`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Review Your Complaint</h4>
                      <p className="text-xs opacity-70 mt-1">Please verify all information before proceeding to submit</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      <p className="text-xs font-semibold uppercase opacity-50">Title</p>
                      <p className="text-sm font-medium mt-1">{complaintForm.title || '-'}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      <p className="text-xs font-semibold uppercase opacity-50">Category</p>
                      <p className="text-sm font-medium mt-1">{selectedCategory?.name || '-'}</p>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                    <p className="text-xs font-semibold uppercase opacity-50">Description</p>
                    <p className="text-sm mt-1">{complaintForm.description || '-'}</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      <p className="text-xs font-semibold uppercase opacity-50">Submission Type</p>
                      <p className="text-sm font-medium mt-1">{complaintForm.isAnonymous ? '🔒 Anonymous' : '👤 Visible'}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      <p className="text-xs font-semibold uppercase opacity-50">Attachments</p>
                      <p className="text-sm font-medium mt-1">{files.length} file(s)</p>
                    </div>
                  </div>
                  {selectedResolverRoutes.length > 0 && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      <p className="text-xs font-semibold uppercase opacity-50">Resolvers ({selectedResolverRoutes.length})</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedResolverRoutes.map(r => <span key={r.id} className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30">{r.officer_name}</span>)}
                      </div>
                    </div>
                  )}
                  {selectedCcOfficers.length > 0 && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      <p className="text-xs font-semibold uppercase opacity-50">CC Recipients ({selectedCcOfficers.length})</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedCcOfficers.map(r => <span key={r.id} className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30">{r.officer_name}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: SUBMIT - Final confirmation and submit button */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div className={`rounded-xl border ${isDark ? 'border-gray-700 bg-gradient-to-br from-gray-800 to-gray-800/50' : 'border-gray-200 bg-gradient-to-br from-white to-gray-50'} p-8 text-center`}>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Ready to Submit?</h3>
                <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Please confirm that all information is correct before submitting.</p>

                <div className={`p-4 rounded-xl mb-6 text-left ${isDark ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>Once submitted, you cannot edit this complaint</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-yellow-400/70' : 'text-yellow-700'}`}>Please ensure all information is accurate before final submission.</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submitComplaint}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm & Submit Complaint
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 mt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}">
            <button type="button" onClick={clearForm} className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Reset
            </button>

            <div className="flex gap-3">
              {currentStep > 1 && (
                <button type="button" onClick={goToPreviousStep} className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
              )}

              {currentStep < totalSteps ? (
                <button type="button" onClick={goToNextStep} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                  Continue
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slide-in-right { animation: slideInRight 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default SubmitComplaint;