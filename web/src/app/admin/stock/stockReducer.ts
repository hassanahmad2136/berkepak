import type { ProductItem, ProductColor } from "./types";

export interface AddFormState {
  name: string;
  slug: string;
  category: string;
  price: string;
  composition: string;
  description: string;
  weaveType: string;
  threadCount: string;
  imageFile: File | null;
  imagePreview: string | null;
}

export interface StockState {
  localProducts: ProductItem[];
  colors: ProductColor[];
  searchQuery: string;
  // Stock editing
  editingStock: Record<string, number>;
  savingIds: Record<string, boolean>;
  successIds: Record<string, boolean>;
  errorIds: Record<string, string | null>;
  // Visibility
  isTogglingVisibility: Record<string, boolean>;
  // Delete modal
  showDeleteConfirm: string | null;
  isDeletingProductId: string | null;
  // Add product modal
  showAddModal: boolean;
  addForm: AddFormState;
  isUploadingImage: boolean;
  isSubmittingAdd: boolean;
  addError: string | null;
  // Add color modal
  showAddColorModal: string | null;
  addColorName: string;
  addColorStock: string;
  isSubmittingColor: boolean;
  addColorError: string | null;
  // Remove color
  removingColorId: string | null;
}

const defaultAddForm: AddFormState = {
  name: "",
  slug: "",
  category: "cotton",
  price: "",
  composition: "",
  description: "",
  weaveType: "",
  threadCount: "",
  imageFile: null,
  imagePreview: null,
};

export type StockAction =
  // Products & colors
  | { type: "SET_PRODUCTS"; products: ProductItem[] }
  | { type: "SET_COLORS"; colors: ProductColor[] }
  | { type: "SET_SEARCH"; query: string }
  // Stock editing
  | { type: "STOCK_EDIT_CHANGE"; colorId: string; value: number }
  | { type: "STOCK_EDIT_CLEAR"; colorId: string }
  | { type: "STOCK_SAVE_START"; colorId: string }
  | { type: "STOCK_SAVE_SUCCESS"; colorId: string; newStock: number }
  | { type: "STOCK_SAVE_ERROR"; colorId: string; error: string }
  | { type: "STOCK_SAVE_DONE"; colorId: string }
  // Visibility
  | { type: "VISIBILITY_TOGGLE_START"; productId: string }
  | { type: "VISIBILITY_TOGGLE_DONE"; productId: string; visible?: boolean }
  // Delete modal
  | { type: "DELETE_CONFIRM_OPEN"; productId: string }
  | { type: "DELETE_CONFIRM_CLOSE" }
  | { type: "DELETE_START"; productId: string }
  | { type: "DELETE_DONE"; productId: string }
  // Add product modal
  | { type: "ADD_MODAL_OPEN" }
  | { type: "ADD_MODAL_CLOSE" }
  | { type: "ADD_FORM_FIELD"; field: keyof AddFormState; value: AddFormState[keyof AddFormState] }
  | { type: "ADD_FORM_NAME_WITH_SLUG"; name: string; slug: string }
  | { type: "ADD_SUBMIT_START" }
  | { type: "ADD_SUBMIT_DONE" }
  | { type: "ADD_UPLOAD_START" }
  | { type: "ADD_UPLOAD_DONE" }
  | { type: "ADD_SET_ERROR"; error: string | null }
  | { type: "ADD_RESET_FORM" }
  // Add color modal
  | { type: "ADD_COLOR_MODAL_OPEN"; catalogId: string }
  | { type: "ADD_COLOR_MODAL_CLOSE" }
  | { type: "ADD_COLOR_FIELD"; field: "addColorName" | "addColorStock"; value: string }
  | { type: "ADD_COLOR_SUBMIT_START" }
  | { type: "ADD_COLOR_SUBMIT_DONE" }
  | { type: "ADD_COLOR_SET_ERROR"; error: string | null }
  // Remove color
  | { type: "COLOR_REMOVE_START"; colorId: string }
  | { type: "COLOR_REMOVE_DONE"; colorId: string };

export function stockReducer(state: StockState, action: StockAction): StockState {
  switch (action.type) {
    case "SET_PRODUCTS":
      return { ...state, localProducts: action.products };

    case "SET_COLORS":
      return { ...state, colors: action.colors };

    case "SET_SEARCH":
      return { ...state, searchQuery: action.query };

    // --- Stock editing ---
    case "STOCK_EDIT_CHANGE":
      return {
        ...state,
        editingStock: { ...state.editingStock, [action.colorId]: action.value },
        successIds: { ...state.successIds, [action.colorId]: false },
        errorIds: { ...state.errorIds, [action.colorId]: null },
      };

    case "STOCK_EDIT_CLEAR": {
      const nextEditing = { ...state.editingStock };
      delete nextEditing[action.colorId];
      return { ...state, editingStock: nextEditing };
    }

    case "STOCK_SAVE_START":
      return {
        ...state,
        savingIds: { ...state.savingIds, [action.colorId]: true },
        errorIds: { ...state.errorIds, [action.colorId]: null },
        successIds: { ...state.successIds, [action.colorId]: false },
      };

    case "STOCK_SAVE_SUCCESS": {
      const nextEditing = { ...state.editingStock };
      delete nextEditing[action.colorId];
      return {
        ...state,
        colors: state.colors.map((c) =>
          c.id === action.colorId ? { ...c, stock: action.newStock } : c
        ),
        successIds: { ...state.successIds, [action.colorId]: true },
        editingStock: nextEditing,
      };
    }

    case "STOCK_SAVE_ERROR":
      return {
        ...state,
        errorIds: { ...state.errorIds, [action.colorId]: action.error },
      };

    case "STOCK_SAVE_DONE":
      return {
        ...state,
        savingIds: { ...state.savingIds, [action.colorId]: false },
      };

    // --- Visibility ---
    case "VISIBILITY_TOGGLE_START":
      return {
        ...state,
        isTogglingVisibility: { ...state.isTogglingVisibility, [action.productId]: true },
      };

    case "VISIBILITY_TOGGLE_DONE":
      return {
        ...state,
        isTogglingVisibility: { ...state.isTogglingVisibility, [action.productId]: false },
        localProducts:
          action.visible !== undefined
            ? state.localProducts.map((p) =>
                p.id === action.productId ? { ...p, available: action.visible! } : p
              )
            : state.localProducts,
      };

    // --- Delete modal ---
    case "DELETE_CONFIRM_OPEN":
      return { ...state, showDeleteConfirm: action.productId };

    case "DELETE_CONFIRM_CLOSE":
      return { ...state, showDeleteConfirm: null, isDeletingProductId: null };

    case "DELETE_START":
      return { ...state, isDeletingProductId: action.productId };

    case "DELETE_DONE":
      return {
        ...state,
        isDeletingProductId: null,
        showDeleteConfirm: null,
        localProducts: state.localProducts.filter((p) => p.id !== action.productId),
        colors: state.colors.filter((c) => c.catalog_id !== action.productId),
      };

    // --- Add product modal ---
    case "ADD_MODAL_OPEN":
      return { ...state, showAddModal: true };

    case "ADD_MODAL_CLOSE":
      return { ...state, showAddModal: false };

    case "ADD_FORM_FIELD":
      return {
        ...state,
        addForm: { ...state.addForm, [action.field]: action.value },
      };

    case "ADD_FORM_NAME_WITH_SLUG":
      return {
        ...state,
        addForm: { ...state.addForm, name: action.name, slug: action.slug },
      };

    case "ADD_SUBMIT_START":
      return { ...state, isSubmittingAdd: true, addError: null };

    case "ADD_SUBMIT_DONE":
      return { ...state, isSubmittingAdd: false };

    case "ADD_UPLOAD_START":
      return { ...state, isUploadingImage: true };

    case "ADD_UPLOAD_DONE":
      return { ...state, isUploadingImage: false };

    case "ADD_SET_ERROR":
      return { ...state, addError: action.error, isSubmittingAdd: false, isUploadingImage: false };

    case "ADD_RESET_FORM":
      return {
        ...state,
        addForm: defaultAddForm,
        showAddModal: false,
        isSubmittingAdd: false,
        isUploadingImage: false,
        addError: null,
      };

    // --- Add color modal ---
    case "ADD_COLOR_MODAL_OPEN":
      return {
        ...state,
        showAddColorModal: action.catalogId,
        addColorName: "",
        addColorStock: "10",
        addColorError: null,
      };

    case "ADD_COLOR_MODAL_CLOSE":
      return { ...state, showAddColorModal: null };

    case "ADD_COLOR_FIELD":
      return { ...state, [action.field]: action.value };

    case "ADD_COLOR_SUBMIT_START":
      return { ...state, isSubmittingColor: true, addColorError: null };

    case "ADD_COLOR_SUBMIT_DONE":
      return {
        ...state,
        isSubmittingColor: false,
        addColorName: "",
        addColorStock: "10",
        showAddColorModal: null,
      };

    case "ADD_COLOR_SET_ERROR":
      return { ...state, addColorError: action.error, isSubmittingColor: false };

    // --- Remove color ---
    case "COLOR_REMOVE_START":
      return { ...state, removingColorId: action.colorId };

    case "COLOR_REMOVE_DONE":
      return {
        ...state,
        removingColorId: null,
        colors: state.colors.filter((c) => c.id !== action.colorId),
      };

    default:
      return state;
  }
}

export function initialStockState(
  products: ProductItem[],
  colors: ProductColor[]
): StockState {
  return {
    localProducts: products,
    colors,
    searchQuery: "",
    editingStock: {},
    savingIds: {},
    successIds: {},
    errorIds: {},
    isTogglingVisibility: {},
    showDeleteConfirm: null,
    isDeletingProductId: null,
    showAddModal: false,
    addForm: defaultAddForm,
    isUploadingImage: false,
    isSubmittingAdd: false,
    addError: null,
    showAddColorModal: null,
    addColorName: "",
    addColorStock: "10",
    isSubmittingColor: false,
    addColorError: null,
    removingColorId: null,
  };
}
