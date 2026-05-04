import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';

const SubmitComplaint = ({ setSubmitSuccess }) => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();
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
  const [ccOfficeIds, setCcOfficeIds] = useState([]);
  const [selectedResolverIds, setSelectedResolverIds] = useState([]);
  const [resolverSelectionValue, setResolverSelectionValue] = useState('');
  const [resolverOfficerIds, setResolverOfficerIds] = useState([]);
  const [ccSearchText, setCcSearchText] = useState('');
  const [ccRegexEnabled, setCcRegexEnabled] = useState(false);
  const totalSteps = 4;

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
      setCategoryResolvers(resolverData?.results || resolverData || []);
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
      errors.description = language === 'am' ? 'መግለጫው ከ500 ቁምፊዎች በታች መሆን አለበት' : 'Description must be under 500 characters';
    }

    setFormErrors(errors);
    return errors;
  };

  const clearForm = () => {
    setComplaintForm({ title: '', description: '', category: '', isAnonymous: false });
    setFiles([]);
    setCcOfficeIds([]);
    setSelectedResolverIds([]);
    setResolverSelectionValue('');
    setResolverOfficerIds([]);
    setCategorySearchText('');
    setCategoryRegexEnabled(false);
    setResolverFilters({ campus: '', college: '', department: '' });
    setCcSearchText('');
    setCcRegexEnabled(false);
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

  const selectCategory = (categoryValue) => {
    setComplaintForm((prev) => ({ ...prev, category: categoryValue }));
    setResolverFilters({ campus: '', college: '', department: '' });
    setSelectedResolverIds([]);
    setResolverSelectionValue('');
    setResolverOfficerIds([]);
  };

  const ccOfficeOptions = useMemo(() => (
    categories.filter((office) => String(office.value) !== String(complaintForm.category))
  ), [categories, complaintForm.category]);

  const selectedCcOffices = ccOfficeOptions.filter((office) => ccOfficeIds.includes(String(office.value)));
  const availableCcOffices = ccOfficeOptions.filter((office) => !ccOfficeIds.includes(String(office.value)));

  useEffect(() => {
    if (!complaintForm.category) {
      return;
    }

    setCcOfficeIds((prev) => prev.filter((officeId) => String(officeId) !== String(complaintForm.category)));
  }, [complaintForm.category]);

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
    language === 'am' ? 'ትክክለኛ የሬገክስ አብራሪ ያስገቡ።' : 'Enter a valid regex pattern.'
  ), [buildSearchMatcher, categorySearchText, categoryRegexEnabled, language]);

  const ccOfficeSearch = useMemo(() => buildSearchMatcher(
    ccSearchText,
    ccRegexEnabled,
    language === 'am' ? 'ትክክለኛ የሬገክስ አብራሪ ያስገቡ።' : 'Enter a valid regex pattern.'
  ), [buildSearchMatcher, ccSearchText, ccRegexEnabled, language]);

  const toSearchableText = useCallback((category) => (
    [
      category?.label,
      category?.office_name,
      category?.office_description,
    ]
      .filter(Boolean)
      .join(' ')
  ), []);

  const filteredCategories = useMemo(() => (
    categories.filter((category) => categorySearch.matcher(toSearchableText(category)))
  ), [categories, categorySearch, toSearchableText]);

  const filteredCcOffices = useMemo(() => (
    availableCcOffices.filter((office) => ccOfficeSearch.matcher(toSearchableText(office)))
  ), [availableCcOffices, ccOfficeSearch, toSearchableText]);

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

  const filteredResolverOfficers = useMemo(() => (
    selectedCategoryResolvers.filter((resolver) => {
      if (resolverFilters.campus && resolver.campus_name !== resolverFilters.campus) return false;
      if (resolverFilters.college && resolver.college_name !== resolverFilters.college) return false;
      if (resolverFilters.department && resolver.department_name !== resolverFilters.department) return false;
      return true;
    })
  ), [selectedCategoryResolvers, resolverFilters]);

  const selectedResolverRoutes = useMemo(() => (
    selectedResolverIds
      .map((resolverId) => selectedCategoryResolvers.find((resolver) => String(resolver.id) === String(resolverId)))
      .filter(Boolean)
  ), [selectedResolverIds, selectedCategoryResolvers]);

  const availableResolverRoutes = useMemo(() => (
    filteredResolverOfficers.filter((resolver) => !selectedResolverIds.includes(String(resolver.id)))
  ), [filteredResolverOfficers, selectedResolverIds]);

  useEffect(() => {
    const officerIds = Array.from(new Set(selectedResolverRoutes.map((resolver) => String(resolver.officer))));
    setResolverOfficerIds(officerIds);
  }, [selectedResolverRoutes]);

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
      const message = language === 'am'
        ? 'አንዳንድ ፋይሎች ተቀባይነት አላገኙም። ከ5MB በታች ያሉ ምስሎች፣ PDF እና ሰነዶች ብቻ ይፈቀዳሉ።'
        : 'Some files were rejected. Only images, PDFs, and documents under 5MB are allowed.';
      alert(message);
    }

    setFiles(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 files
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCcOfficeSelection = (officeId) => {
    setCcOfficeIds((prev) => {
      const id = String(officeId);
      return prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
    });
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

  const removeCcOffice = (officeId) => {
    setCcOfficeIds((prev) => prev.filter((item) => String(item) !== String(officeId)));
  };

  const selectAllCcOffices = () => {
    setCcOfficeIds(ccOfficeOptions.map((office) => String(office.value)));
  };

  const clearCcOffices = () => {
    setCcOfficeIds([]);
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      if (errors.category) {
        setCurrentStep(1);
      } else if (errors.title || errors.description) {
        setCurrentStep(2);
      }
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', complaintForm.title);
      formData.append('description', complaintForm.description);
      formData.append('category', complaintForm.category);
      formData.append('is_anonymous', complaintForm.isAnonymous ? 'true' : 'false');

      // CC backend offices as JSON
      if (ccOfficeIds.length > 0) {
        formData.append('cc_office_ids', JSON.stringify(ccOfficeIds));
      }

      if (resolverOfficerIds.length > 0) {
        formData.append('cc_officer_ids', JSON.stringify(resolverOfficerIds.map((officerId) => Number(officerId))));
      }

      // Add files to form data
      files.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await apiService.createComplaint(formData);

      if (response) {
        clearForm();
        setSubmitSuccess(true);

        // Hide success message after 5 seconds
        setTimeout(() => setSubmitSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      const message = language === 'am'
        ? 'ቅሬታ ማስገባት አልተሳካም። እባክዎ እንደገና ይሞክሩ።'
        : 'Failed to submit complaint. Please try again.';
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
                {language === 'am' ? `ደረጃ ${currentStep} / ${totalSteps}` : `Step ${currentStep} of ${totalSteps}`}
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
                  {language === 'am' ? '1. ምድብ እና ተዛማጅ መረጃ' : '1. Category & Routing'}
                </h4>
                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    {language === 'am' ? 'ምድብ' : 'Category'} *
                  </label>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          {language === 'am' ? 'ምድብ ፈልግ' : 'Search category'}
                        </label>
                        <input
                          type="text"
                          value={categorySearchText}
                          onChange={(e) => setCategorySearchText(e.target.value)}
                          placeholder={language === 'am' ? 'ስም ወይም መግለጫ' : 'Name or description'}
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                        />
                      </div>
                      <label className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <input
                          type="checkbox"
                          checked={categoryRegexEnabled}
                          onChange={(e) => setCategoryRegexEnabled(e.target.checked)}
                        />
                        {language === 'am' ? 'ሬገክስ ይጠቀሙ' : 'Use regex'}
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
                                  <span className={`block text-sm font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{cat.label}</span>
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
                      {language === 'am' ? 'ምድቦች አልተገኙም። ፍለጋውን ያስተካክሉ።' : 'No categories match. Adjust the search.'}
                    </p>
                  )}
                  {formErrors.category && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.category}</p>}
                </div>

                <div className={`rounded-lg border p-4 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-blue-200 bg-blue-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-blue-700'}`}>
                    {language === 'am' ? 'የሪዞልቨር ማስተላለፊያ መረጃ' : 'Resolver routing preview'}
                  </p>
                  {selectedCategory ? (
                    <>
                      <div className={`mt-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        <p className="font-medium">{selectedCategory.label}</p>
                        {selectedCategory.office_description && (
                          <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedCategory.office_description}</p>
                        )}
                      </div>
                      {selectedCategoryResolvers.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {selectedCategoryResolvers.map((resolver) => (
                            <div
                              key={resolver.id}
                              className={`rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className={`font-medium ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                                  {resolver.officer_name}
                                </p>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isDark ? 'bg-gray-600 text-gray-200' : 'bg-blue-100 text-blue-700'}`}>
                                  {resolver.scope_label || 'General'}
                                </span>
                              </div>
                              <div className={`mt-2 grid gap-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'} sm:grid-cols-3`}>
                                <span>Campus: {resolver.campus_name || 'All'}</span>
                                <span>College: {resolver.college_name || 'All'}</span>
                                <span>Department: {resolver.department_name || 'All'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {language === 'am' ? 'ለዚህ ምድብ ገና ሪዞልቨር አልተመደበም።' : 'No resolver assignments are available for this category yet.'}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {language === 'am' ? 'እባክዎ መጀመሪያ ምድብ ይምረጡ።' : 'Select a category first to load resolver routing details.'}
                    </p>
                  )}
                </div>

                {selectedCategory && selectedCategoryResolvers.length > 0 && (
                  <div className={`rounded-lg border p-4 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {language === 'am' ? 'ልዩ ሪዞልቨር መንገዶች' : 'Specific resolver routes'}
                        </p>
                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {language === 'am'
                            ? 'ካምፓስ፣ ኮሌጅ እና ዲፓርትመንት በመምረጥ ልዩ የCategoryResolver መንገዶችን ይምረጡ።'
                            : 'Filter by campus, college, and department, then choose specific CategoryResolver routes.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={selectAllResolverRoutes}
                          className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                        >
                          {language === 'am' ? 'ሁሉንም ይምረጡ' : 'Select all'}
                        </button>
                        <button
                          type="button"
                          onClick={clearResolverRouteSelections}
                          className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {language === 'am' ? 'አጽዳ' : 'Clear'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div>
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          {language === 'am' ? 'ካምፓስ' : 'Campus'}
                        </label>
                        <select
                          value={resolverFilters.campus}
                          onChange={(e) => setResolverFilters((prev) => ({ ...prev, campus: e.target.value, college: '', department: '' }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                        >
                          <option value="">{language === 'am' ? 'ሁሉም' : 'All'}</option>
                          {resolverCampusOptions.map((campus) => (
                            <option key={campus} value={campus}>{campus}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          {language === 'am' ? 'ኮሌጅ' : 'College'}
                        </label>
                        <select
                          value={resolverFilters.college}
                          onChange={(e) => setResolverFilters((prev) => ({ ...prev, college: e.target.value, department: '' }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                        >
                          <option value="">{language === 'am' ? 'ሁሉም' : 'All'}</option>
                          {resolverCollegeOptions.map((college) => (
                            <option key={college} value={college}>{college}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                          {language === 'am' ? 'ዲፓርትመንት' : 'Department'}
                        </label>
                        <select
                          value={resolverFilters.department}
                          onChange={(e) => setResolverFilters((prev) => ({ ...prev, department: e.target.value }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                        >
                          <option value="">{language === 'am' ? 'ሁሉም' : 'All'}</option>
                          {resolverDepartmentOptions.map((department) => (
                            <option key={department} value={department}>{department}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>
                        {language === 'am' ? 'የሚገኙ የCategoryResolver ምርጫዎች' : 'Available CategoryResolver routes'}
                      </label>
                      {availableResolverRoutes.length === 0 ? (
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {language === 'am' ? 'ይህን ማጣሪያ የሚያሟሉ ሪዞልቨር መንገዶች የሉም።' : 'No CategoryResolver routes match the selected scope filters.'}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            value={resolverSelectionValue}
                            onChange={(e) => setResolverSelectionValue(e.target.value)}
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                          >
                            <option value="">{language === 'am' ? 'CategoryResolver ይምረጡ' : 'Select CategoryResolver route'}</option>
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
                            {language === 'am' ? 'ጨምር' : 'Add'}
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
                                  {language === 'am' ? 'አስወግድ' : 'Remove'}
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
                        {language === 'am'
                          ? `የተመረጡ የCategoryResolver መንገዶች: ${selectedResolverRoutes.length}`
                          : `Selected CategoryResolver routes: ${selectedResolverRoutes.length}`}
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
                    {language === 'am'
                      ? 'ቅሬታዬን በማንነት ሳይገለጽ እንዲታይ እፈልጋለሁ (ለኦፊሰሮች ብቻ ማንነት ይደበቃል)'
                      : 'Submit as anonymous to officers (your identity is hidden from officers but preserved for audit/admin).'}
                  </span>
                </label>

                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    {language === 'am' ? 'CC የቢሮ አማራጮች ይምረጡ' : 'CC Backend Offices (Select one or more)'}
                  </label>
                  {ccOfficeOptions.length === 0 ? (
                    <div className={`w-full border rounded-lg px-4 py-3 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-600'}`}>
                      {language === 'am' ? 'ቢሮዎች አልተገኙም' : 'No backend offices found'}
                    </div>
                  ) : (
                    <div className={`border rounded-lg p-3 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {language === 'am'
                            ? 'ብዙ ቢሮዎችን ለመምረጥ ምልክት ያድርጉ'
                            : 'Choose multiple offices to receive CC notifications'}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={selectAllCcOffices}
                            className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          >
                            {language === 'am' ? 'ሁሉንም ይምረጡ' : 'Select all'}
                          </button>
                          <button
                            type="button"
                            onClick={clearCcOffices}
                            className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                          >
                            {language === 'am' ? 'አጽዳ' : 'Clear'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-3">
                        <div className="md:col-span-2">
                          <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>
                            {language === 'am' ? 'ቢሮ ፈልግ' : 'Search office'}
                          </label>
                          <input
                            type="text"
                            value={ccSearchText}
                            onChange={(e) => setCcSearchText(e.target.value)}
                            placeholder={language === 'am' ? 'ስም፣ ካምፓስ፣ ኮሌጅ፣ ዲፓርትመንት' : 'Name, campus, college, department'}
                            className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                          />
                        </div>
                        <label className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          <input
                            type="checkbox"
                            checked={ccRegexEnabled}
                            onChange={(e) => setCcRegexEnabled(e.target.checked)}
                          />
                          {language === 'am' ? 'ሬገክስ ይጠቀሙ' : 'Use regex'}
                        </label>
                      </div>

                      {ccOfficeSearch.error && (
                        <p className="text-red-500 text-xs mb-2 flex items-center">
                          <span className="mr-1">⚠️</span>{ccOfficeSearch.error}
                        </p>
                      )}

                      <div className="max-h-52 overflow-y-auto space-y-2">
                        {filteredCcOffices.length === 0 ? (
                          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {language === 'am' ? 'የሚገኙ ቢሮዎች የሉም።' : 'No available offices match.'}
                          </div>
                        ) : (
                          filteredCcOffices.map((office) => (
                            <button
                              key={office.value}
                              type="button"
                              onClick={() => toggleCcOfficeSelection(office.value)}
                              className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${isDark
                                ? 'border-gray-600 bg-gray-700 hover:border-blue-400'
                                : 'border-gray-200 bg-white hover:border-blue-300'} `}
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{office.label}</span>
                                <span className={`h-5 w-5 rounded-full border flex items-center justify-center ${isDark ? 'border-gray-500 text-transparent' : 'border-gray-300 text-transparent'}`}>
                                  +
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {language === 'am'
                      ? `የተመረጡ ቢሮዎች: ${ccOfficeIds.length}`
                      : `Selected backend offices: ${ccOfficeIds.length}`}
                  </p>
                  {selectedCcOffices.length > 0 && (
                    <div className={`mt-2 flex flex-wrap gap-2 text-xs ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                      {selectedCcOffices.map((office) => (
                        <button
                          key={office.value}
                          type="button"
                          onClick={() => removeCcOffice(office.value)}
                          className={`rounded-full px-3 py-1 flex items-center gap-2 ${isDark ? 'bg-gray-700' : 'bg-blue-100 text-blue-700'}`}
                          title={language === 'am' ? 'አስወግድ' : 'Remove'}
                        >
                          <span>{office.label}</span>
                          <span className="text-[10px]">✕</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {language === 'am' ? '2. የቅሬታ ዝርዝሮች' : '2. Complaint Details'}
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
                  {language === 'am' ? '3. ማስረጃ ፋይሎች' : '3. Evidence Attachments'}
                </h4>
                <div>
                  <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    {language === 'am' ? 'ፋይሎች አያይዝ (አማራጭ)' : 'Attach Files (Optional)'}
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
                        {language === 'am'
                          ? 'ፋይሎችን ለመጫን ይጫኑ ወይም እዚህ ይጎትቱ'
                          : 'Click to upload files or drag and drop'
                        }
                      </p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                        {language === 'am'
                          ? 'ከ5MB በታች ያሉ ምስሎች፣ PDF፣ ሰነዶች (ከ5 ፋይሎች በታች)'
                          : 'Images, PDFs, Documents under 5MB (Max 5 files)'
                        }
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
                  {language === 'am' ? '4. ክለሳ እና ማስገባት' : '4. Review & Submit'}
                </h4>
                <div className={`rounded-lg border p-4 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-semibold">{t('title')}:</span> {complaintForm.title || '-'}</p>
                    <p><span className="font-semibold">{t('description')}:</span> {complaintForm.description || '-'}</p>
                    <p>
                      <span className="font-semibold">{language === 'am' ? 'ምድብ' : 'Category'}:</span>{' '}
                      {categories.find((item) => String(item.value) === String(complaintForm.category))?.label || '-'}
                    </p>
                    <p><span className="font-semibold">{language === 'am' ? 'ማንነት ሁኔታ' : 'Identity'}:</span> {complaintForm.isAnonymous ? (language === 'am' ? 'ስውር' : 'Anonymous') : (language === 'am' ? 'ተገልጿል' : 'Visible')}</p>
                    <p><span className="font-semibold">{language === 'am' ? 'CC ቢሮዎች' : 'CC Backend Offices'}:</span> {ccOfficeIds.length}</p>
                    {selectedCcOffices.length > 0 && (
                      <div>
                        <p className="font-semibold mb-1">{language === 'am' ? 'የተመረጡ ቢሮዎች ዝርዝር' : 'Selected office list'}:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedCcOffices.map((office) => (
                            <li key={office.value}>{office.label}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p><span className="font-semibold">{language === 'am' ? 'ፋይሎች' : 'Attachments'}:</span> {files.length}</p>
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
                    {language === 'am' ? 'ወደ ኋላ' : 'Back'}
                  </button>
                )}

                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {language === 'am' ? 'ቀጣይ' : 'Next'}
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
