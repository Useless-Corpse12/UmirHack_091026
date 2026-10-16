import api from './client'
import type { Application, CartItem, MenuResponse, Order, Organization, Restaurant } from '../types'

// AUTH
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then(r => r.data)

export const register = (email: string, password: string, displayName: string, contactInfo?: string) =>
  api.post('/auth/register', { email, password, displayName, contactInfo }).then(r => r.data)

export const applyRegistration = (email: string, displayName: string, role: string) =>
  api.post('/applications', { email, displayName, role }).then(r => r.data)

// RESTAURANTS
export const getRestaurants = (): Promise<Restaurant[]> =>
  api.get('/organizations/restaurants').then(r => r.data)

export const getMenu = (orgId: string): Promise<MenuResponse> =>
  api.get(`/menu/${orgId}`).then(r => r.data)

// ORDERS
export const createOrder = (restaurantId: string, deliveryAddress: string, items: CartItem[]) =>
  api.post('/orders', {
    restaurantId,
    deliveryAddress,
    items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
  }).then(r => r.data)

export const getMyOrders = (): Promise<Order[]> =>
  api.get('/orders').then(r => r.data)

export const getOrderById = (id: string): Promise<Order> =>
  api.get(`/orders/${id}`).then(r => r.data)

export const updateOrderStatus = (id: string, status: string) =>
  api.patch(`/orders/${id}/status`, { status }).then(r => r.data)

// COURIER
export const startShift = () => api.post('/courier/shift/start').then(r => r.data)
export const endShift = () => api.post('/courier/shift/end').then(r => r.data)
export const getAvailableOrders = () => api.get('/courier/orders/available').then(r => r.data)
export const getCurrentOrder = () => api.get('/courier/orders/current').then(r => r.data)
export const acceptOrder = (id: string) => api.post(`/courier/orders/${id}/accept`).then(r => r.data)
export const completeOrder = (id: string) => api.post(`/courier/orders/${id}/complete`).then(r => r.data)
export const getCourierHistory = () => api.get('/courier/orders/history').then(r => r.data)

// RESTAURANT (OrganizationOwner)
export const getMyOrg = (): Promise<Organization> =>
  api.get('/organizations/my').then(r => r.data)

export const createRestaurant = (data: object) =>
  api.post('/organizations/restaurants', data).then(r => r.data)

export const updateRestaurant = (id: string, data: object) =>
  api.put(`/organizations/restaurants/${id}`, data).then(r => r.data)

export const deleteRestaurant = (id: string) =>
  api.delete(`/organizations/restaurants/${id}`)

export const createMenuItem = (data: object) =>
  api.post('/menu', data).then(r => r.data)

export const updateMenuItem = (id: string, data: object) =>
  api.put(`/menu/${id}`, data).then(r => r.data)

export const deleteMenuItem = (id: string) =>
  api.delete(`/menu/${id}`)

// MODERATOR
export const getApplications = (pendingOnly = true): Promise<Application[]> =>
  api.get(`/moderator/applications?pendingOnly=${pendingOnly}`).then(r => r.data)

export const reviewApplication = (id: string, status: string, moderatorNote?: string) =>
  api.patch(`/moderator/applications/${id}`, { status, moderatorNote }).then(r => r.data)

export const createUser = (data: object) =>
  api.post('/moderator/users', data).then(r => r.data)

export const getCouriers = () => api.get('/moderator/couriers').then(r => r.data)
export const getOrganizations = () => api.get('/moderator/organizations').then(r => r.data)
export const getAllOrders = () => api.get('/moderator/orders').then(r => r.data)
export const blockCourier = (id: string, isBlocked: boolean) =>
  api.patch(`/moderator/couriers/${id}/block`, { isBlocked }).then(r => r.data)
export const blockOrganization = (id: string, isBlocked: boolean) =>
  api.patch(`/moderator/organizations/${id}/block`, { isBlocked }).then(r => r.data)
