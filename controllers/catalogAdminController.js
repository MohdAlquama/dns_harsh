import {
    createCatalogProduct, deleteCatalogProduct, getCatalogProductById,
    listAdminCatalogProducts, updateCatalogProduct
} from "../models/catalogProductModel.js";
import { buildCatalogProduct, toFormData } from "../services/catalogProductService.js";

const configFor = (type) => type === "TEST_SERIES"
    ? { label: "Test Series", plural: "Test Series", basePath: "/test-series", icon: "file-check-2" }
    : { label: "Book", plural: "Books", basePath: "/books", icon: "library" };

const parseId = (value) => {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const renderForm = (res, type, { status = 200, error = null, productId = null, formData = {} } = {}) => {
    const config = configFor(type);
    return res.status(status).render("layouts/layout", {
        title: `${productId ? "Edit" : "New"} ${config.label} | DNS Admin`,
        page: "../catalog/form", type, config, error, productId, formData
    });
};

const showCatalogList = async (req, res) => {
    const config = configFor(req.catalogType);
    try {
        const products = await listAdminCatalogProducts(req.catalogType);
        return res.render("layouts/layout", {
            title: `${config.plural} | DNS Admin`, page: "../catalog/index",
            type: req.catalogType, config, products,
            saved: req.query.saved === "1", updated: req.query.updated === "1",
            deleted: req.query.deleted === "1", error: req.query.error || null
        });
    } catch (error) {
        console.error(`${config.label} list error:`, error);
        return res.status(500).render("layouts/layout", {
            title: `${config.plural} | DNS Admin`, page: "../catalog/index",
            type: req.catalogType, config, products: [], saved: false, updated: false,
            deleted: false, error: `Unable to load ${config.plural.toLowerCase()}`
        });
    }
};

const showNewCatalogForm = (req, res) => renderForm(res, req.catalogType);

const showEditCatalogForm = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).send("Product not found");
    try {
        const product = await getCatalogProductById(id, req.catalogType);
        if (!product) return res.status(404).send("Product not found");
        return renderForm(res, req.catalogType, { productId: id, formData: toFormData(product) });
    } catch (error) {
        console.error("Load catalog product error:", error);
        return res.status(500).send("Unable to load product");
    }
};

const addCatalogProduct = async (req, res) => {
    try {
        await createCatalogProduct(buildCatalogProduct(req.catalogType, req.body));
        return res.redirect(`${configFor(req.catalogType).basePath}?saved=1`);
    } catch (error) {
        console.error("Create catalog product error:", error);
        const message = error.code === "ER_DUP_ENTRY" ? "Slug, ISBN, or SKU already exists" : error.message;
        return renderForm(res, req.catalogType, { status: 400, error: message, formData: req.body });
    }
};

const editCatalogProduct = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).send("Product not found");
    try {
        await updateCatalogProduct(id, req.catalogType, buildCatalogProduct(req.catalogType, req.body));
        return res.redirect(`${configFor(req.catalogType).basePath}?updated=1`);
    } catch (error) {
        console.error("Update catalog product error:", error);
        const status = error.code === "NOT_FOUND" ? 404 : 400;
        const message = error.code === "ER_DUP_ENTRY" ? "Slug, ISBN, or SKU already exists" : error.message;
        return renderForm(res, req.catalogType, { status, error: message, productId: id, formData: req.body });
    }
};

const removeCatalogProduct = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id || !await deleteCatalogProduct(id, req.catalogType)) throw new Error("Product not found");
        return res.redirect(`${configFor(req.catalogType).basePath}?deleted=1`);
    } catch (error) {
        return res.redirect(`${configFor(req.catalogType).basePath}?error=${encodeURIComponent(error.message)}`);
    }
};

export {
    addCatalogProduct, editCatalogProduct, removeCatalogProduct, showCatalogList,
    showEditCatalogForm, showNewCatalogForm
};
