import test from "node:test";
import { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ejs from "ejs";
import db from "../config/db.js";
import { buildPageUrl, parseUserFilters } from "../controllers/userController.js";
import { buildUserWhere } from "../models/userModel.js";

after(() => db.end());

test("user filters normalize untrusted query values", () => {
    assert.deepEqual(parseUserFilters({ search: "  Ravi  ", status: "active", page: "3", pageSize: "50" }), {
        search: "Ravi", status: "active", page: 3, pageSize: 50
    });
    assert.deepEqual(parseUserFilters({ status: "deleted", page: "-4", pageSize: "999" }), {
        search: "", status: "all", page: 1, pageSize: 20
    });
});

test("user SQL filters use parameters", () => {
    assert.deepEqual(buildUserWhere({ search: "987", status: "inactive" }), {
        sql: "WHERE (name LIKE ? OR phone_number LIKE ?) AND status = ?",
        params: ["%987%", "%987%", 0]
    });
});

test("user list pagination accepts only the controller's fixed numeric page sizes", () => {
    assert.deepEqual(parseUserFilters({ page: "2", pageSize: "100" }), {
        search: "", status: "all", page: 2, pageSize: 100
    });
    assert.equal(parseUserFilters({ pageSize: "20; DROP TABLE auth_users" }).pageSize, 20);
});

test("pagination links preserve active filters", () => {
    assert.equal(buildPageUrl({ search: "A B", status: "active", pageSize: 50 }, 2), "/users?search=A+B&status=active&pageSize=50&page=2");
});

test("users page compiles with EJS", () => {
    const template = fs.readFileSync(new URL("../views/users/index.ejs", import.meta.url), "utf8");
    assert.doesNotThrow(() => ejs.compile(template));
});
