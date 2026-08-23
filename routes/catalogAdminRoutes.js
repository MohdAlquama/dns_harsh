import express from "express";
import requireSameOrigin from "../middleware/requireSameOrigin.js";
import {
    addCatalogProduct, editCatalogProduct, removeCatalogProduct, showCatalogList,
    showEditCatalogForm, showNewCatalogForm
} from "../controllers/catalogAdminController.js";

const router = express.Router();
const type = (catalogType) => (req, _res, next) => { req.catalogType = catalogType; next(); };

for (const [path, catalogType] of [["/test-series", "TEST_SERIES"], ["/books", "BOOK"]]) {
    router.get(path, type(catalogType), showCatalogList);
    router.get(`${path}/new`, type(catalogType), showNewCatalogForm);
    router.post(path, requireSameOrigin, type(catalogType), addCatalogProduct);
    router.get(`${path}/:id/edit`, type(catalogType), showEditCatalogForm);
    router.post(`${path}/:id/edit`, requireSameOrigin, type(catalogType), editCatalogProduct);
    router.post(`${path}/:id/delete`, requireSameOrigin, type(catalogType), removeCatalogProduct);
}

export default router;
