export const ROUTE_PATHS = {
  HOME: 'home',
  DASHBOARD: 'dashboard',
} as const;

type RouteKey = keyof typeof ROUTE_PATHS;

type AppRoute = `/${(typeof ROUTE_PATHS)[RouteKey]}`;

export const APP_LINKS: Record<RouteKey, AppRoute> = {
  HOME: `/${ROUTE_PATHS.HOME}`,
  DASHBOARD: `/${ROUTE_PATHS.DASHBOARD}`,
};
