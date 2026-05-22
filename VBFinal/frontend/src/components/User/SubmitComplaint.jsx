import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const SubmitComplaint = ({ setSubmitSuccess, onComplaintSubmitted }) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();
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
  const totalSteps = 4;

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
      const categoriesResponse = await apiService.getAllCategories();
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
    } catch (error) {
      console.error('Failed to load categories:', error);
    }

    try {
      const resolverData = await apiService.getAllCategoryResolvers();
      const normalizedResolvers = (resolverData?.results || resolverData || []).map((resolver) => ({
        ...resolver,
        id: resolver.resolver_id || resolver.id,
        officer_name: resolver.category_name || resolver.scope_label || 'Resolver route',
        scope_label: resolver.scope_label || resolver.category_name || 'Resolver route',
        campus_name: resolver.campus_name || '',
        college_name: resolver.college_name || '',
        department_name: resolver.department_name || '',
        officer: resolver.officer || null,
      }));
      setCategoryResolvers(normalizedResolvers);
    } catch (error) {
      console.warn('Failed to load category resolvers:', error);
      setCategoryResolvers([]);
    }

  }, [buildCategoryLabel]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const validateForm = () => {
    const errors = {};
    if (!complaintForm.title.trim()) errors.title = t('required');
    if (!complaintForm.description.trim()) errors.description = t('required');
    if (!complaintForm.category) errors.category = t('required');
    if (complaintForm.description.length > 500) {
      errors.description = 'Description must be under 500 characters';
    }

    setFormErrors(errors);
    return errors;
  };

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

  // Auto-select all officers when all three filters (campus, college, department) are filled
  useEffect(() => {
    if (
      resolverFilters.campus &&
      resolverFilters.college &&
      resolverFilters.department &&
      selectedCategoryResolvers.length > 0
    ) {
      // Get all officers matching the current filters
      const matchingOfficers = selectedCategoryResolvers.filter((resolver) => {
        return (
          resolver.campus_name === resolverFilters.campus &&
          resolver.college_name === resolverFilters.college &&
          resolver.department_name === resolverFilters.department
        );
      });

      if (matchingOfficers.length > 0) {
        // Auto-select all matching officers
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
    const officerIds = Array.from(new Set(selectedResolverRoutes.map((resolver) => String(resolver.officer))));
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
    const errors = validateForm();
    if (step === 1) {
      return !errors.category;
    }
    if (step === 2) {
      return !errors.title && !errors.description;
    }
    return true;
  };

  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      const message = 'Some files were rejected. Only images, PDFs, and documents under 5MB are allowed.';
      alert(message);
    }

    setFiles(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 files
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

  const submitComplaint = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (selectedResolverIds.length > 0 && selectedResolverRoutes.length === 0) {
      errors.resolver_ids = 'Please select CategoryResolver routes that match your complaint scope.';
    }
    if (Object.keys(errors).length > 0) {
      if (errors.category) {
        setCurrentStep(1);
      } else if (errors.title || errors.description) {
        setCurrentStep(2);
      }
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
      if (selectedScope.campus) {
        formData.append('campus', selectedScope.campus);
      }
      if (selectedScope.college) {
        formData.append('college', selectedScope.college);
      }
      if (selectedScope.department) {
        formData.append('department', selectedScope.department);
      }

      // CC CategoryResolver officers as JSON
      if (ccOfficerIds.length > 0) {
        const ccOfficerNumbers = ccOfficerIds
          .map((id) => selectedCategoryResolvers.find((resolver) => String(resolver.id) === String(id)))
          .filter(Boolean)
          .map((resolver) => resolver.officer)
          .filter(Boolean)
          .map(Number);

        if (ccOfficerNumbers.length > 0) {
          ccOfficerNumbers.forEach((officerId) => {
            formData.append('cc_officer_ids', String(officerId));
          });
        }
      }

      // Main resolver route officers
      if (resolverOfficerIds.length > 0) {
        resolverOfficerIds.forEach((officerId) => {
          formData.append('resolver_officer_ids', String(Number(officerId)));
        });
      }
      // Also send explicit resolver ids (CategoryResolver ids) when user selected specific routes
      if (selectedResolverIds.length > 0) {
        selectedResolverIds.forEach((id) => {
          formData.append('resolver_ids', String(id));
        });
      }
      // Add files to form data
      files.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await apiService.createComplaint(formData);

      if (response) {
        clearForm();
        setSubmitSuccess(true);
        
        // Call the onComplaintSubmitted callback to trigger refresh in MyComplaints
        if (onComplaintSubmitted) {
          onComplaintSubmitted();
        }

        // Hide success message after 5 seconds
        setTimeout(() => setSubmitSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      const message = 'Failed to submit complaint. Please try again.';
      alert(message);
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('submit_new_complaint')}
          </h3>
        </div>

        <div className="p-6">
          <form onSubmit={submitComplaint} className="space-y-6">
            <div className="flex items-center justify-between">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Step {currentStep} of {totalSteps}
              </p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-10 rounded-full ${step <= currentStep ? 'bg-blue-600' : isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>

            {currentStep === 1 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  1. Select Related Category
                </h4>
                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    Category
                  </label>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          Search category
                        </label>
                        <input
                          type="text"
                          value={categorySearchText}
                          onChange={(e) => setCategorySearchText(e.target.value)}
                          placeholder="Name or description"
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                        />
                      </div>
                      <label className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <input
                          type="checkbox"
                          checked={categoryRegexEnabled}
                          onChange={(e) => setCategoryRegexEnabled(e.target.checked)}
                        />
                        Use regex
                      </label>
                    </div>

                    <div className={`border rounded-lg p-3 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'} ${formErrors.category ? 'border-red-500' : ''}`}>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {filteredCategories.map((cat) => {
                          const isSelected = String(complaintForm.category) === String(cat.value);
                          return (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => selectCategory(cat.value)}
                              className={`group w-full text-left rounded-lg border px-3 py-2 transition-colors ${isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : isDark
                                  ? 'border-gray-600 bg-gray-700 hover:border-blue-400'
                                  : 'border-gray-200 bg-white hover:border-blue-300'} `}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span>
                                  <span className={`block text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{cat.name || cat.office_name}</span>
                                  {cat.office_description && (
                                    <span className={`mt-1 block overflow-hidden text-xs transition-all duration-200 ${isDark ? 'text-gray-400' : 'text-gray-500'} max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100`}>
                                      {cat.office_description}
                                    </span>
                                  )}
                                </span>
                                <span className={`h-5 w-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : isDark ? 'border-gray-500 text-transparent' : 'border-gray-300 text-transparent'}`}>
                                  ✓
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <input type="hidden" value={complaintForm.category} readOnly />
                  {categorySearch.error && (
                    <p className="text-red-500 text-xs mt-2 flex items-center">
                      <span className="mr-1">⚠️</span>{categorySearch.error}
                    </p>
                  )}
                  {!categorySearch.error && filteredCategories.length === 0 && (
                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      No categories match. Adjust the search.
                    </p>
                  )}
                  {formErrors.category && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.category}</p>}
                </div>

                {selectedCategory && selectedCategoryResolvers.length > 0 && (
                  <div className={`rounded-lg border p-4 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Filter by campus, college, and department, then choose specific Offices.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={selectAllResolverRoutes}
                          className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={clearResolverRouteSelections}
                          className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div>
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          Campus
                        </label>
                        <select
                          value={resolverFilters.campus}
                          onChange={(e) => setResolverFilters((prev) => ({ ...prev, campus: e.target.value, college: '', department: '' }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                        >
                          <option value="">All</option>
                          {resolverCampusOptions.map((campus) => (
                            <option key={campus} value={campus}>{campus}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          College
                        </label>
                        <select
                          value={resolverFilters.college}
                          onChange={(e) => setResolverFilters((prev) => ({ ...prev, college: e.target.value, department: '' }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                        >
                          <option value="">All</option>
                          {resolverCollegeOptions.map((college) => (
                            <option key={college} value={college}>{college}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          Department
                        </label>
                        <select
                          value={resolverFilters.department}
                          onChange={(e) => setResolverFilters((prev) => ({ ...prev, department: e.target.value }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                        >
                          <option value="">All</option>
                          {resolverDepartmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
                        Available CategoryResolver routes
                      </label>
                      {availableResolverRoutes.length === 0 ? (
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          No CategoryResolver routes match the selected scope filters.
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            value={resolverSelectionValue}
                            onChange={(e) => setResolverSelectionValue(e.target.value)}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                          >
                            <option value="">Select CategoryResolver route</option>
                            {availableResolverRoutes.map((resolver) => (
                              <option key={resolver.id} value={resolver.id}>
                                {`${resolver.officer_name} | ${resolver.scope_label || 'General'}${resolver.campus_name ? ` | ${resolver.campus_name}` : ''}${resolver.college_name ? ` | ${resolver.college_name}` : ''}${resolver.department_name ? ` | ${resolver.department_name}` : ''}`}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addResolverRouteSelection}
                            disabled={!resolverSelectionValue}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add
                          </button>
                        </div>
                      )}

                      {selectedResolverRoutes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {selectedResolverRoutes.map((resolver) => (
                            <div key={resolver.id} className={`rounded-lg border px-3 py-2 ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                                  {resolver.officer_name}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => removeResolverRouteSelection(resolver.id)}
                                  className="text-xs text-red-500 hover:text-red-600"
                                >
                                  Remove
                                </button>
                              </div>
                              <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {resolver.scope_label || 'General'}
                                {resolver.campus_name ? ` · ${resolver.campus_name}` : ''}
                                {resolver.college_name ? ` · ${resolver.college_name}` : ''}
                                {resolver.department_name ? ` · ${resolver.department_name}` : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Selected CategoryResolver routes: {selectedResolverRoutes.length}
                      </p>
                    </div>
                  </div>
                )}

                <label className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={complaintForm.isAnonymous}
                    onChange={(e) => setComplaintForm({ ...complaintForm, isAnonymous: e.target.checked })}
                  />
                  <span>
                    Submit as anonymous to officers (your identity is hidden from officers but preserved for audit/admin).
                  </span>
                </label>

                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    Select CC CategoryResolvers
                  </label>
                  {selectedCategory && selectedCategoryResolvers.length > 0 ? (
                    <div className={`border rounded-lg p-3 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Filter CC recipients by campus, college, and department
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={selectAllCcOfficers}
                            className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={clearCcOfficerSelections}
                            className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Campus</label>
                          <select
                            value={ccFilters.campus}
                            onChange={(e) => setCcFilters((prev) => ({ ...prev, campus: e.target.value, college: '', department: '' }))}
                            className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                          >
                            <option value="">All</option>
                            {ccCampusOptions.map((campus) => (
                              <option key={campus} value={campus}>{campus}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>College</label>
                          <select
                            value={ccFilters.college}
                            onChange={(e) => setCcFilters((prev) => ({ ...prev, college: e.target.value, department: '' }))}
                            className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                          >
                            <option value="">All</option>
                            {ccCollegeOptions.map((college) => (
                              <option key={college} value={college}>{college}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Department</label>
                          <select
                            value={ccFilters.department}
                            onChange={(e) => setCcFilters((prev) => ({ ...prev, department: e.target.value }))}
                            className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                          >
                            <option value="">All</option>
                            {ccDepartmentOptions.map((department) => (
                              <option key={department} value={department}>{department}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-3">
                        <div className="md:col-span-2">
                          <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                            Search CC recipient
                          </label>
                          <input
                            type="text"
                            value={ccSearchText}
                            onChange={(e) => setCcSearchText(e.target.value)}
                            placeholder="Name, campus, college, department"
                            className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                          />
                        </div>
                        <label className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          <input
                            type="checkbox"
                            checked={ccRegexEnabled}
                            onChange={(e) => setCcRegexEnabled(e.target.checked)}
                          />
                          Use regex
                        </label>
                      </div>

                      {ccOfficeSearch.error && (
                        <p className="text-red-500 text-xs mb-2 flex items-center">
                          <span className="mr-1">⚠️</span>{ccOfficeSearch.error}
                        </p>
                      )}

                      <div className="max-h-52 overflow-y-auto space-y-2">
                        {availableCcOfficers.length === 0 ? (
                          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            No CC recipients match the selected filters.
                          </div>
                        ) : (
                          availableCcOfficers.filter((resolver) => ccOfficeSearch.matcher(toSearchableText(resolver))).map((resolver) => (
                            <button
                              key={resolver.id}
                              type="button"
                              onClick={() => addCcOfficerSelection(resolver.id)}
                              className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isDark
                                ? 'border-gray-600 bg-gray-700 hover:border-blue-400'
                                : 'border-gray-200 bg-white hover:border-blue-300'} `}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span>
                                  <span className={`block text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                                    {resolver.officer_name}
                                  </span>
                                  <span className={`block text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {resolver.scope_label || 'General'}
                                    {resolver.campus_name ? ` · ${resolver.campus_name}` : ''}
                                    {resolver.college_name ? ` · ${resolver.college_name}` : ''}
                                    {resolver.department_name ? ` · ${resolver.department_name}` : ''}
                                  </span>
                                </span>
                                <span className={`h-5 w-5 rounded-full border flex items-center justify-center ${isDark ? 'border-gray-500 text-transparent' : 'border-gray-300 text-transparent'}`}>
                                  +
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>

                      <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Selected CC recipients: {selectedCcOfficers.length}
                      </p>

                      {selectedCcOfficers.length > 0 && (
                        <div className={`mt-2 flex flex-wrap gap-2 text-xs ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                          {selectedCcOfficers.map((resolver) => (
                            <button
                              key={resolver.id}
                              type="button"
                              onClick={() => removeCcOfficerSelection(resolver.id)}
                              className={`rounded-full px-3 py-1 flex items-center gap-2 ${isDark ? 'bg-gray-700' : 'bg-blue-100 text-blue-700'}`}
                              title="Remove"
                            >
                              <span>{resolver.officer_name}</span>
                              <span className="text-[10px]">✕</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`w-full border rounded-lg px-4 py-3 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-600'}`}>
                      Select a category first
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  2. Complaint Details
                </h4>
                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    {t('title')} *
                  </label>
                  <input
                    type="text"
                    value={complaintForm.title}
                    onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                    className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} ${formErrors.title ? 'border-red-500' : ''}`}
                    placeholder={t('brief_title')}
                  />
                  {formErrors.title && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.title}</p>}
                </div>

                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    {t('description')} *
                  </label>
                  <textarea
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                    rows={5}
                    className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} ${formErrors.description ? 'border-red-500' : ''}`}
                    placeholder={t('detailed_description')}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {formErrors.description && <p className="text-red-500 text-sm flex items-center"><span className="mr-1">⚠️</span>{formErrors.description}</p>}
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} ml-auto`}>
                      {complaintForm.description.length}/500
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  3. Evidence Attachments
                </h4>
                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    Attach Files (Optional)
                  </label>
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isDark ? 'border-gray-600 bg-gray-750' : 'border-gray-300 bg-gray-50'}`}>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.doc,.docx"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="text-4xl mb-2">📎</div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Click to upload files or drag and drop
                      </p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                        Images, PDFs, Documents under 5MB (Max 5 files)
                      </p>
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((file, index) => (
                        <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{getFileIcon(file)}</span>
                            <div>
                              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {file.name}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  4. Review & Submit
                </h4>
                <div className={`rounded-lg border p-4 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-semibold">{t('title')}:</span> {complaintForm.title || '-'}</p>
                    <p><span className="font-semibold">{t('description')}:</span> {complaintForm.description || '-'}</p>
                    <p>
                      <span className="font-semibold">Category:</span>{' '}
                      {categories.find((item) => String(item.value) === String(complaintForm.category))?.label || '-'}
                    </p>
                    <p><span className="font-semibold">Identity:</span> {complaintForm.isAnonymous ? 'Anonymous' : 'Visible'}</p>
                    <p><span className="font-semibold">CC CategoryResolvers:</span> {ccOfficerIds.length}</p>
                    {selectedCcOfficers.length > 0 && (
                      <div>
                        <p className="font-semibold mb-1">Selected CC recipient list:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedCcOfficers.map((resolver) => (
                            <li key={resolver.id}>{resolver.officer_name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p><span className="font-semibold">Attachments:</span> {files.length}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={clearForm}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t('cancel')}
              </button>

              <div className="flex items-center gap-3">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={goToPreviousStep}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                  >
                    Back
                  </button>
                )}

                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    <span>{loading ? t('loading') : t('submit')}</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitComplaint;