import React, { useState, useEffect } from 'react';
import { FaUtensils, FaPlus, FaEdit, FaTrash, FaSpinner, FaSave, FaChevronDown, FaChevronRight, FaSync, FaBuilding, FaUpload, FaImage, FaTimes } from 'react-icons/fa';
import api from '../utils/api';

// Helper function to normalize image URLs
// Converts absolute URLs from the same API server to relative URLs
// Then prepends API base URL to relative paths
const nodeApiBase = import.meta.env.VITE_NODE_API_URL || 'http://localhost:5001';
const normalizedApiBase = nodeApiBase.replace(/\/$/, '');
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's an absolute URL, check if it's from the same API server
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    // Extract the path from absolute URL if it's from our API server
    try {
      const url = new URL(imagePath);
      const apiUrl = new URL(normalizedApiBase);
      
      // If same origin (host + port), convert to relative path
      if (url.origin === apiUrl.origin) {
        return imagePath; // Same origin, use as-is (will work)
      }
      // Different origin but has /uploads/ path, try to extract relative path
      if (url.pathname.startsWith('/uploads/')) {
        return `${normalizedApiBase}${url.pathname}`;
      }
    } catch (e) {
      // Invalid URL, fall through to return as-is
    }
    return imagePath; // External URL or invalid, use as-is
  }
  
  // Relative path starting with /
  if (imagePath.startsWith("/")) {
    return `${normalizedApiBase}${imagePath}`;
  }
  
  // Just filename, construct full path
  return `${normalizedApiBase}/uploads/${imagePath}`;
};

const DefaultMenu = () => {
  const [defaultMenu, setDefaultMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingItemCategoryIndex, setEditingItemCategoryIndex] = useState(null);
  const [franchises, setFranchises] = useState([]);
  const [selectedFranchises, setSelectedFranchises] = useState(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushResults, setPushResults] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    icon: '',
    sortOrder: 0,
    isActive: true,
  });
  const [itemFormData, setItemFormData] = useState({
    name: '',
    description: '',
    price: 0,
    image: '',
    spiceLevel: 'NONE',
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    tags: [],
    allergens: [],
    calories: '',
  });

  const spiceLevels = ['NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTREME'];

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // Don't set Content-Type manually - axios will automatically set it with the correct boundary for FormData
      const response = await api.post('/menu/uploads', formData);

      // The backend returns relative URL (e.g., /uploads/filename.jpg)
      // The getImageUrl helper will prepend the API base URL when displaying
      setItemFormData({ ...itemFormData, image: response.data.url });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    fetchDefaultMenu();
    fetchFranchises();
  }, []);

  const fetchDefaultMenu = async () => {
    try {
      setLoading(true);
      const response = await api.get('/default-menu');
      setDefaultMenu(response.data);
      // Expand all categories by default
      if (response.data?.categories) {
        setExpandedCategories(new Set(response.data.categories.map((_, idx) => idx)));
      }
    } catch (error) {
      console.error('Error fetching default menu:', error);
      // Initialize empty menu if none exists
      setDefaultMenu({ categories: [] });
    } finally {
      setLoading(false);
    }
  };

  const fetchFranchises = async () => {
    try {
      const response = await api.get('/users');
      const franchiseUsers = (response.data || []).filter(u => u.role === 'franchise_admin');
      setFranchises(franchiseUsers);
    } catch (error) {
      console.error('Error fetching franchises:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/default-menu', {
        categories: defaultMenu.categories,
      });
      alert('Default menu saved successfully!\n\nNote: This menu will be used for new franchises. Use "Push to Franchises" to update existing franchises.');
      await fetchDefaultMenu();
    } catch (error) {
      console.error('Error saving default menu:', error);
      alert(error.response?.data?.message || 'Failed to save default menu');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPushModal = () => {
    if (!defaultMenu?.categories || defaultMenu.categories.length === 0) {
      alert('Please create and save menu first before pushing to franchises.');
      return;
    }
    setSelectedFranchises(new Set());
    setPushResults(null);
    setShowPushModal(true);
  };

  const handlePushToFranchises = async () => {
    if (selectedFranchises.size === 0) {
      alert('Please select at least one franchise.');
      return;
    }

    const selectedList = Array.from(selectedFranchises);
    const franchiseNames = selectedList.map(id => {
      const f = franchises.find(fr => fr._id === id);
      return f?.name || 'Unknown';
    }).join(', ');

    if (!window.confirm(
      `Push default menu to ${selectedFranchises.size} franchise(s)?\n\n` +
      `Franchises: ${franchiseNames}\n\n` +
      `This will:\n` +
      `• Replace the default menu for each selected franchise\n` +
      `• The franchise menu will then automatically sync to all their carts\n\n` +
      `Continue?`
    )) {
      return;
    }

    setPushing(true);
    const results = [];

    for (const franchiseId of selectedList) {
      const franchise = franchises.find(f => f._id === franchiseId);
      try {
        const response = await api.post(`/default-menu/push/franchise/${franchiseId}`);
        results.push({
          franchiseId,
          franchiseName: franchise?.name || 'Unknown',
          success: true,
          message: `Updated ${response.data.cartsUpdated || response.data.cafesUpdated || 0} carts`,
          data: response.data
        });
      } catch (error) {
        results.push({
          franchiseId,
          franchiseName: franchise?.name || 'Unknown',
          success: false,
          message: error.response?.data?.message || error.message
        });
      }
    }

    setPushResults(results);
    setPushing(false);
  };

  const toggleSelectAllFranchises = () => {
    if (selectedFranchises.size === franchises.length) {
      setSelectedFranchises(new Set());
    } else {
      setSelectedFranchises(new Set(franchises.map(f => f._id)));
    }
  };

  const toggleFranchiseSelection = (franchiseId) => {
    const newSelected = new Set(selectedFranchises);
    if (newSelected.has(franchiseId)) {
      newSelected.delete(franchiseId);
    } else {
      newSelected.add(franchiseId);
    }
    setSelectedFranchises(newSelected);
  };

  const toggleCategory = (index) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      description: '',
      icon: '',
      sortOrder: (defaultMenu?.categories?.length || 0),
      isActive: true,
    });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category, index) => {
    setEditingCategory(index);
    setCategoryFormData({ ...category });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = (index) => {
    if (!window.confirm('Are you sure you want to delete this category and all its items?')) {
      return;
    }
    const newCategories = [...defaultMenu.categories];
    newCategories.splice(index, 1);
    setDefaultMenu({ ...defaultMenu, categories: newCategories });
  };

  const handleSaveCategory = () => {
    const newCategories = [...(defaultMenu?.categories || [])];
    if (editingCategory !== null) {
      newCategories[editingCategory] = {
        ...newCategories[editingCategory],
        ...categoryFormData,
        items: newCategories[editingCategory].items || [],
      };
    } else {
      newCategories.push({
        ...categoryFormData,
        items: [],
      });
    }
    setDefaultMenu({ ...defaultMenu, categories: newCategories });
    setShowCategoryModal(false);
    setEditingCategory(null);
  };

  const handleAddItem = (categoryIndex) => {
    setEditingItem(null);
    setEditingItemCategoryIndex(categoryIndex);
    setItemFormData({
      name: '',
      description: '',
      price: 0,
      image: '',
      spiceLevel: 'NONE',
      isAvailable: true,
      isFeatured: false,
      sortOrder: (defaultMenu.categories[categoryIndex].items || []).length,
      tags: [],
      allergens: [],
      calories: '',
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item, categoryIndex, itemIndex) => {
    setEditingItem(itemIndex);
    setEditingItemCategoryIndex(categoryIndex);
    setItemFormData({ ...item });
    setShowItemModal(true);
  };

  const handleDeleteItem = (categoryIndex, itemIndex) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }
    const newCategories = [...defaultMenu.categories];
    newCategories[categoryIndex].items.splice(itemIndex, 1);
    setDefaultMenu({ ...defaultMenu, categories: newCategories });
  };

  const handleSaveItem = () => {
    const newCategories = [...defaultMenu.categories];
    const category = newCategories[editingItemCategoryIndex];
    
    if (!category.items) {
      category.items = [];
    }

    if (editingItem !== null) {
      category.items[editingItem] = {
        ...itemFormData,
        calories: itemFormData.calories ? Number(itemFormData.calories) : undefined,
      };
    } else {
      category.items.push({
        ...itemFormData,
        calories: itemFormData.calories ? Number(itemFormData.calories) : undefined,
      });
    }

    setDefaultMenu({ ...defaultMenu, categories: newCategories });
    setShowItemModal(false);
    setEditingItem(null);
    setEditingItemCategoryIndex(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Global Default Menu</h1>
          <p className="text-gray-600 mt-1">
            Create the master menu template. Push this menu to franchises, who can then customize and push to their carts.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleAddCategory}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FaPlus className="mr-2" />
            Add Category
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <FaSave className="mr-2" />
                Save Menu
              </>
            )}
          </button>
          <button
            onClick={handleOpenPushModal}
            disabled={!defaultMenu?.categories || defaultMenu.categories.length === 0}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <FaSync className="mr-2" />
            Push to Franchises
          </button>
        </div>
      </div>

      {/* Menu Flow Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Menu Hierarchy Flow</h3>
        <div className="flex items-center gap-4 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">1</span>
            <span>Super Admin creates Global Menu</span>
          </div>
          <span>→</span>
          <div className="flex items-center gap-2">
            <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold">2</span>
            <span>Push to Franchises (one by one)</span>
          </div>
          <span>→</span>
          <div className="flex items-center gap-2">
            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">3</span>
            <span>Franchise pushes to their Carts</span>
          </div>
          <span>→</span>
          <div className="flex items-center gap-2">
            <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold">4</span>
            <span>Cart Admin toggles availability only</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {!defaultMenu?.categories || defaultMenu.categories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaUtensils className="mx-auto text-4xl mb-4" />
            <p className="mb-2">No categories in default menu. Click "Add Category" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {defaultMenu.categories.map((category, catIndex) => (
              <div key={catIndex} className="border border-gray-200 rounded-lg">
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                  onClick={() => toggleCategory(catIndex)}
                >
                  <div className="flex items-center space-x-3">
                    {expandedCategories.has(catIndex) ? (
                      <FaChevronDown className="text-gray-500" />
                    ) : (
                      <FaChevronRight className="text-gray-500" />
                    )}
                    <FaUtensils className="text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-lg">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-500">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      {category.items?.length || 0} Items
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      category.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCategory(category, catIndex);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(catIndex);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                {expandedCategories.has(catIndex) && (
                  <div className="p-4 space-y-4">
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={() => handleAddItem(catIndex)}
                        className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        <FaPlus className="mr-1" />
                        Add Item
                      </button>
                    </div>
                    {category.items && category.items.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                        {category.items.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className={`bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow transition-all ${
                              item.isAvailable
                                ? "border-slate-200"
                                : "border-amber-300 bg-amber-50"
                            }`}
                          >
                            {/* Item Image */}
                            <div className="h-32 md:h-36 bg-gradient-to-br from-slate-100 to-slate-200 relative">
                              {item.image ? (
                                <img
                                  src={getImageUrl(item.image)}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src =
                                      "https://via.placeholder.com/150x80?text=No+Image";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-2xl text-slate-300">🍽️</span>
                                </div>
                              )}
                              {/* Badges */}
                              <div className="absolute top-1 left-1 flex gap-0.5">
                                {item.isFeatured && (
                                  <span className="text-xs">⭐</span>
                                )}
                                {!item.isAvailable && (
                                  <span className="px-1 py-0.5 bg-red-500 text-white text-[10px] rounded">
                                    Off
                                  </span>
                                )}
                              </div>
                              {/* Price */}
                              <div className="absolute bottom-1 right-1">
                                <span className="px-1.5 py-0.5 bg-blue-600 text-white font-bold rounded text-xs shadow">
                                  ₹{typeof item.price === 'number' ? item.price.toFixed(0) : item.price}
                                </span>
                              </div>
                            </div>

                            {/* Item Details */}
                            <div className="p-2">
                              <h4
                                className="font-semibold text-sm text-slate-800 truncate"
                                title={item.name}
                              >
                                {item.name}
                              </h4>

                              {item.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                  {item.description}
                                </p>
                              )}

                              {/* Meta Tags */}
                              <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                                {item.spiceLevel && item.spiceLevel !== "NONE" && (
                                  <span>🌶️</span>
                                )}
                                {item.calories && (
                                  <span className="text-slate-400">
                                    {item.calories}cal
                                  </span>
                                )}
                                {item.tags?.length > 0 && (
                                  <span className="text-purple-500">
                                    {item.tags[0]}
                                  </span>
                                )}
                                {item.allergens?.length > 0 && (
                                  <span className="text-red-400">⚠️</span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-100">
                                <button
                                  onClick={() => handleEditItem(item, catIndex, itemIndex)}
                                  className="flex-1 text-[10px] px-1 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                                  title="Edit"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(catIndex, itemIndex)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <FaTrash size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="col-span-full text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <span className="text-2xl mb-1 block">🍽️</span>
                        <p className="text-sm">
                          No items yet. Click "Add Item" to add.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Push to Franchises Modal */}
      {showPushModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <FaBuilding className="text-purple-600" />
              Push Menu to Franchises
            </h2>
            
            {pushResults ? (
              // Show results
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Push Results</h3>
                <div className="space-y-2">
                  {pushResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        result.success 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.franchiseName}</span>
                        <span className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                          {result.success ? '✓ Success' : '✗ Failed'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setShowPushModal(false);
                      setPushResults(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              // Show franchise selection
              <div className="space-y-4">
                <p className="text-gray-600 text-sm">
                  Select the franchises you want to push the default menu to. 
                  Each franchise will receive a copy of this menu, which they can then customize and push to their carts.
                </p>
                
                <div className="flex items-center justify-between border-b pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFranchises.size === franchises.length && franchises.length > 0}
                      onChange={toggleSelectAllFranchises}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">Select All ({franchises.length} franchises)</span>
                  </label>
                  <span className="text-sm text-gray-500">
                    {selectedFranchises.size} selected
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2">
                  {franchises.length > 0 ? (
                    franchises.map((franchise) => (
                      <label
                        key={franchise._id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFranchises.has(franchise._id)
                            ? 'bg-purple-50 border-purple-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFranchises.has(franchise._id)}
                          onChange={() => toggleFranchiseSelection(franchise._id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{franchise.name}</p>
                          <p className="text-sm text-gray-500">{franchise.email}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          franchise.isActive !== false
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {franchise.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FaBuilding className="mx-auto text-3xl mb-2" />
                      <p>No franchises found</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => setShowPushModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePushToFranchises}
                    disabled={pushing || selectedFranchises.size === 0}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {pushing ? (
                      <>
                        <FaSpinner className="animate-spin mr-2" />
                        Pushing...
                      </>
                    ) : (
                      <>
                        <FaSync className="mr-2" />
                        Push to {selectedFranchises.size} Franchise(s)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {editingCategory !== null ? 'Edit Category' : 'Add Category'}
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveCategory(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <input
                  type="text"
                  value={categoryFormData.icon}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
                  placeholder="Icon name or emoji"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={categoryFormData.sortOrder}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, sortOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={categoryFormData.isActive}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm text-gray-700">Active</label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCategory !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingItem !== null ? 'Edit Item' : 'Add Item'}
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveItem(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={itemFormData.name}
                    onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={itemFormData.price}
                    onChange={(e) => setItemFormData({ ...itemFormData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={itemFormData.description}
                    onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Image</label>
                  <div className="flex items-start space-x-4">
                    {/* Image Preview */}
                    <div className="flex-shrink-0">
                      {itemFormData.image ? (
                        <div className="relative">
                          <img
                            src={getImageUrl(itemFormData.image)}
                            alt="Preview"
                            className="w-24 h-24 object-cover rounded-lg border border-gray-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/96?text=No+Image';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setItemFormData({ ...itemFormData, image: '' })}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <FaTimes size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
                          <FaImage className="text-gray-400 text-2xl" />
                        </div>
                      )}
                    </div>
                    
                    {/* Upload Controls */}
                    <div className="flex-grow space-y-2">
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                          {uploadingImage ? (
                            <>
                              <FaSpinner className="animate-spin mr-2" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <FaUpload className="mr-2" />
                              Upload Image
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">Max size: 5MB. Formats: JPG, PNG, GIF</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">Or enter URL:</span>
                        <input
                          type="text"
                          value={itemFormData.image}
                          onChange={(e) => setItemFormData({ ...itemFormData, image: e.target.value })}
                          placeholder="https://example.com/image.jpg or /uploads/image.jpg"
                          className="flex-grow px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spice Level</label>
                  <select
                    value={itemFormData.spiceLevel}
                    onChange={(e) => setItemFormData({ ...itemFormData, spiceLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {spiceLevels.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={itemFormData.sortOrder}
                    onChange={(e) => setItemFormData({ ...itemFormData, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormData.calories}
                    onChange={(e) => setItemFormData({ ...itemFormData, calories: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={itemFormData.isAvailable}
                    onChange={(e) => setItemFormData({ ...itemFormData, isAvailable: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Available</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={itemFormData.isFeatured}
                    onChange={(e) => setItemFormData({ ...itemFormData, isFeatured: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Featured</span>
                </label>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowItemModal(false);
                    setEditingItem(null);
                    setEditingItemCategoryIndex(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingItem !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefaultMenu;
