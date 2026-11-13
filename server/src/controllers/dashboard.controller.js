import { prisma } from "../config/database.js";

const REQUEST_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
];

const getRequestFilter = (user) => {
  if (user.role === "ADMIN") {
    return {};
  }

  if (user.role === "EMPLOYEE") {
    return {
      requesterId: user.id,
    };
  }

  if (user.role === "SUPPORT_STAFF") {
    const conditions = [];

    if (user.departmentId) {
      conditions.push({
        departmentId: user.departmentId,
      });
    }

    conditions.push({
      assignments: {
        some: {
          assigneeId: user.id,
        },
      },
    });

    return {
      OR: conditions,
    };
  }

  return {
    id: "NO_ACCESS",
  };
};

const getAssignmentFilter = (user) => {
  if (user.role === "ADMIN") {
    return {};
  }

  if (user.role === "SUPPORT_STAFF") {
    return {
      assigneeId: user.id,
    };
  }

  // Employees can view assignments belonging to their requests.
  return {
    request: {
      requesterId: user.id,
    },
  };
};

const buildStatusCounts = (groups) => {
  const counts = Object.fromEntries(
    REQUEST_STATUSES.map((status) => [status, 0]),
  );

  for (const group of groups) {
    counts[group.status] = group._count._all;
  }

  return counts;
};

const getDashboardData = async (user) => {
  const requestFilter = getRequestFilter(user);
  const assignmentFilter = getAssignmentFilter(user);

  const [
    totalRequests,
    statusGroups,
    recentRequests,
    totalAssignments,
    activeAssignments,
    recentAssignments,
  ] = await Promise.all([
    prisma.serviceRequest.count({
      where: requestFilter,
    }),

    prisma.serviceRequest.groupBy({
      by: ["status"],
      where: requestFilter,
      _count: {
        _all: true,
      },
    }),

    prisma.serviceRequest.findMany({
      where: requestFilter,
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        requestCode: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    prisma.assignment.count({
      where: assignmentFilter,
    }),

    prisma.assignment.count({
      where: {
        ...assignmentFilter,
        isActive: true,
      },
    }),

    prisma.assignment.findMany({
      where: assignmentFilter,
      take: 5,
      orderBy: {
        assignedAt: "desc",
      },
      select: {
        id: true,
        requestId: true,
        assigneeId: true,
        assignedById: true,
        isActive: true,
        assignedAt: true,
        unassignedAt: true,
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        request: {
          select: {
            id: true,
            requestCode: true,
            title: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const statusCounts = buildStatusCounts(statusGroups);

  const baseStats = {
    totalRequests,
    ...statusCounts,
    totalAssignments,
    activeAssignments,
  };

  if (user.role === "EMPLOYEE") {
    return {
      role: user.role,
      stats: {
        ...baseStats,
        pendingRequests:
          statusCounts.OPEN +
          statusCounts.ASSIGNED +
          statusCounts.IN_PROGRESS +
          statusCounts.ON_HOLD,
      },
      recentRequests,
    };
  }

  if (user.role === "SUPPORT_STAFF") {
    const myActiveAssignments = await prisma.assignment.count({
      where: {
        assigneeId: user.id,
        isActive: true,
      },
    });

    return {
      role: user.role,
      stats: {
        ...baseStats,
        myActiveAssignments,
        pendingRequests:
          statusCounts.OPEN +
          statusCounts.ASSIGNED +
          statusCounts.IN_PROGRESS +
          statusCounts.ON_HOLD,
      },
      recentRequests,
      recentAssignments,
    };
  }

  if (user.role === "ADMIN") {
    const [
      totalUsers,
      totalEmployees,
      totalSupportStaff,
      totalDepartments,
      totalCategories,
      activeUsers,
      inactiveUsers,
      blockedUsers,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: { role: "EMPLOYEE" },
      }),

      prisma.user.count({
        where: { role: "SUPPORT_STAFF" },
      }),

      prisma.department.count(),

      prisma.category.count(),

      prisma.user.count({
        where: { status: "ACTIVE" },
      }),

      prisma.user.count({
        where: { status: "INACTIVE" },
      }),

      prisma.user.count({
        where: { status: "BLOCKED" },
      }),
    ]);

    return {
      role: user.role,
      stats: {
        ...baseStats,
        totalUsers,
        totalEmployees,
        totalSupportStaff,
        totalDepartments,
        totalCategories,
        activeUsers,
        inactiveUsers,
        blockedUsers,
        pendingRequests:
          statusCounts.OPEN +
          statusCounts.ASSIGNED +
          statusCounts.IN_PROGRESS +
          statusCounts.ON_HOLD,
      },
      recentRequests,
      recentAssignments,
    };
  }

  return null;
};

// GET /api/v1/dashboard
export const getDashboard = async (req, res) => {
  try {
    const data = await getDashboardData(req.user);

    if (!data) {
      return res.status(403).json({
        success: false,
        message: "Dashboard access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dashboard data fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
};

// GET /api/v1/dashboard/overview
export const getDashboardOverview = async (req, res) => {
  try {
    const data = await getDashboardData(req.user);

    if (!data) {
      return res.status(403).json({
        success: false,
        message: "Dashboard access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dashboard overview fetched successfully",
      data: {
        role: data.role,
        stats: data.stats,
      },
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview",
    });
  }
};
