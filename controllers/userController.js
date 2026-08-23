import { listUsers } from "../models/userModel.js";

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100];

const parseUserFilters = (query = {}) => {
    const requestedPage = Number.parseInt(query.page, 10);
    const requestedPageSize = Number.parseInt(query.pageSize, 10);
    const status = ["active", "inactive"].includes(query.status) ? query.status : "all";

    return {
        search: String(query.search || "").trim().slice(0, 100),
        status,
        page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
        pageSize: ALLOWED_PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : 20
    };
};

const buildPageUrl = (filters, page) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.pageSize !== 20) params.set("pageSize", String(filters.pageSize));
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/users?${query}` : "/users";
};

const showUsers = async (req, res) => {
    try {
        const filters = parseUserFilters(req.query);
        let result = await listUsers(filters);
        const pageCount = Math.max(1, Math.ceil(result.total / filters.pageSize));

        if (filters.page > pageCount) {
            filters.page = pageCount;
            result = await listUsers(filters);
        }

        const firstPage = Math.max(1, filters.page - 2);
        const lastPage = Math.min(pageCount, filters.page + 2);
        const pages = Array.from({ length: lastPage - firstPage + 1 }, (_, index) => {
            const page = firstPage + index;
            return { page, url: buildPageUrl(filters, page) };
        });

        return res.render("layouts/layout", {
            title: "Users | DNS Admin",
            page: "../users/index",
            users: result.users,
            summary: result.summary,
            filters,
            pagination: {
                page: filters.page,
                pageCount,
                total: result.total,
                from: result.total ? (filters.page - 1) * filters.pageSize + 1 : 0,
                to: Math.min(filters.page * filters.pageSize, result.total),
                pages,
                previousUrl: filters.page > 1 ? buildPageUrl(filters, filters.page - 1) : null,
                nextUrl: filters.page < pageCount ? buildPageUrl(filters, filters.page + 1) : null
            }
        });
    } catch (error) {
        console.error("User list error:", error);
        return res.status(500).send("Unable to load users");
    }
};

export { buildPageUrl, parseUserFilters, showUsers };
