import {
  getAllSlas as fetchAllSlas,
  getSlaById as fetchSlaById,
  createSla as createSlaService,
  updateSla as updateSlaService,
  deleteSla as deleteSlaService,
  getApplicableSla,
} from "../services/sla.service.js";

// GET /api/v1/slas
export const getAllSlas = async (req, res, next) => {
  try {
    const filters = req.validated?.query || {};

    const result = await fetchAllSlas(filters);

    return res.status(200).json({
      success: true,
      message: "SLA policies fetched successfully.",
      data: result.slas,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/slas/:id
export const getSlaById = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    const sla = await fetchSlaById(id);

    return res.status(200).json({
      success: true,
      message: "SLA policy fetched successfully.",
      data: sla,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/slas
export const createSla = async (req, res, next) => {
  try {
    const sla = await createSlaService(req.body);

    return res.status(201).json({
      success: true,
      message: "SLA policy created successfully.",
      data: sla,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/slas/:id
export const updateSla = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    const sla = await updateSlaService(id, req.body);

    return res.status(200).json({
      success: true,
      message: "SLA policy updated successfully.",
      data: sla,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/slas/:id
export const deleteSla = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    await deleteSlaService(id);

    return res.status(200).json({
      success: true,
      message: "SLA policy deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/slas/applicable/:priority?departmentId=UUID
export const getApplicableSlaPolicy = async (req, res, next) => {
  try {
    const { priority } = req.validated.params;
    const { departmentId } = req.validated.query;

    const sla = await getApplicableSla(priority, departmentId);

    return res.status(200).json({
      success: true,
      message: "Applicable SLA policy fetched successfully.",
      data: sla,
    });
  } catch (error) {
    next(error);
  }
};
