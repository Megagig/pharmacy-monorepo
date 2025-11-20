// Templates Store - State management for report templates
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ReportTemplate, TemplateBuilder, TemplateCategory } from '../types/templates';

interface TemplatesState {
    // Templates
    templates: Record<string, ReportTemplate>;

    // Template categories
    categories: TemplateCategory[];

    // Template builder state
    builder: TemplateBuilder | null;

    // UI state
    templateDialogOpen: boolean;
    builderOpen: boolean;
    selectedTemplate: string | null;

    // Actions
    addTemplate: (template: ReportTemplate) => void;
    updateTemplate: (templateId: string, updates: Partial<ReportTemplate>) => void;
    removeTemplate: (templateId: string) => void;
    setCategories: (categories: TemplateCategory[]) => void;
    setBuilder: (builder: TemplateBuilder | null) => void;
    updateBuilder: (updates: Partial<TemplateBuilder>) => void;
    setTemplateDialogOpen: (open: boolean) => void;
    setBuilderOpen: (open: boolean) => void;
    setSelectedTemplate: (templateId: string | null) => void;

    // Computed getters
    getTemplate: (templateId: string) => ReportTemplate | null;
    getTemplatesByCategory: (categoryId: string) => ReportTemplate[];
    getUserTemplates: (userId: string) => ReportTemplate[];
    getPublicTemplates: () => ReportTemplate[];
    getFeaturedTemplates: () => ReportTemplate[];
}

export const useTemplatesStore = create<TemplatesState>()(
    devtools(
        persist(
            (set, get) => ({
                // Initial state
                templates: {},
                categories: [],
                builder: null,
                templateDialogOpen: false,
                builderOpen: false,
                selectedTemplate: null,

                // Actions
                addTemplate: (template: ReportTemplate) => {
                    set(
                        (state) => ({
                            templates: {
                                ...state.templates,
                                [template.id]: template,
                            },
                        }),
                        false,
                        'addTemplate'
                    );
                },

                updateTemplate: (templateId: string, updates: Partial<ReportTemplate>) => {
                    set(
                        (state) => {
                            const existingTemplate = state.templates[templateId];
                            if (!existingTemplate) return state;

                            return {
                                templates: {
                                    ...state.templates,
                                    [templateId]: {
                                        ...existingTemplate,
                                        ...updates,
                                        updatedAt: new Date(),
                                    },
                                },
                            };
                        },
                        false,
                        'updateTemplate'
                    );
                },

                removeTemplate: (templateId: string) => {
                    set(
                        (state) => {
                            const newTemplates = { ...state.templates };
                            delete newTemplates[templateId];
                            return {
                                templates: newTemplates,
                                selectedTemplate: state.selectedTemplate === templateId ? null : state.selectedTemplate,
                            };
                        },
                        false,
                        'removeTemplate'
                    );
                },

                setCategories: (categories: TemplateCategory[]) => {
                    set({ categories }, false, 'setCategories');
                },

                setBuilder: (builder: TemplateBuilder | null) => {
                    set({ builder }, false, 'setBuilder');
                },

                updateBuilder: (updates: Partial<TemplateBuilder>) => {
                    set(
                        (state) => {
                            if (!state.builder) return state;

                            return {
                                builder: {
                                    ...state.builder,
                                    ...updates,
                                    isDirty: true,
                                },
                            };
                        },
                        false,
                        'updateBuilder'
                    );
                },

                setTemplateDialogOpen: (open: boolean) => {
                    set({ templateDialogOpen: open }, false, 'setTemplateDialogOpen');
                },

                setBuilderOpen: (open: boolean) => {
                    set({ builderOpen: open }, false, 'setBuilderOpen');
                },

                setSelectedTemplate: (templateId: string | null) => {
                    set({ selectedTemplate: templateId }, false, 'setSelectedTemplate');
                },

                // Computed getters
                getTemplate: (templateId: string) => {
                    const state = get();
                    return state.templates[templateId] || null;
                },

                getTemplatesByCategory: (categoryId: string) => {
                    const state = get();
                    return Object.values(state.templates).filter(
                        template => template.metadata.category === categoryId
                    );
                },

                getUserTemplates: (userId: string) => {
                    const state = get();
                    return Object.values(state.templates).filter(
                        template => template.createdBy === userId
                    );
                },

                getPublicTemplates: () => {
                    const state = get();
                    return Object.values(state.templates).filter(
                        template => template.isPublic
                    );
                },

                getFeaturedTemplates: () => {
                    const state = get();
                    return Object.values(state.templates).filter(
                        template => template.metadata.tags.includes('featured')
                    );
                },
            }),
            {
                name: 'templates-store',
                partialize: (state) => ({
                    // Only persist templates and categories
                    templates: state.templates,
                    categories: state.categories,
                    selectedTemplate: state.selectedTemplate,
                }),
            }
        ),
        { name: 'TemplatesStore' }
    )
);

// Selectors for better performance
export const useTemplates = () => useTemplatesStore((state) => state.templates);
export const useTemplateCategories = () => useTemplatesStore((state) => state.categories);
export const useTemplateBuilder = () => useTemplatesStore((state) => state.builder);
export const useTemplateDialogOpen = () => useTemplatesStore((state) => state.templateDialogOpen);
export const useBuilderOpen = () => useTemplatesStore((state) => state.builderOpen);
export const useSelectedTemplate = () => useTemplatesStore((state) => state.selectedTemplate);

export const useTemplate = (templateId: string) =>
    useTemplatesStore((state) => state.getTemplate(templateId));

export const useTemplatesByCategory = (categoryId: string) =>
    useTemplatesStore((state) => state.getTemplatesByCategory(categoryId));

export const useUserTemplates = (userId: string) =>
    useTemplatesStore((state) => state.getUserTemplates(userId));

export const usePublicTemplates = () =>
    useTemplatesStore((state) => state.getPublicTemplates());

export const useFeaturedTemplates = () =>
    useTemplatesStore((state) => state.getFeaturedTemplates());