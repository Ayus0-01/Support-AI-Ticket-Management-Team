import api from "../api";

export type CreateTicketBody = {
  subject: string;
  category: string;
  description: string;
  department: string;
  site: string;
  asset_tag: string;
  preferred_contact: string;
};

export type Ticket = {
  ticket_id: string;
  requester?: {
    username: string;
    email: string;
  };
  subject: string;
  category: string;
  description: string;
  department?: string;
  site?: string;
  asset_tag?: string;
  preferred_contact?: string;
  status: string;
  priority: string | null;
  severity: string | null;
  subcategory: string | null;
  confidence?: number | null;
  path?: string | null;
  sla: string | null;
  assignee: string | null;
  resolution_reply?: string | null;
  created_at: string;
  updated_at: string;
};

export const createTicket = async (body: CreateTicketBody) => {
  const response = await api.post("/api/tickets/", body);
  return response.data;
};

export const getMyTickets = async (): Promise<Ticket[]> => {
  const response = await api.get("/api/tickets/my/");
  return response.data.tickets;
};

export const getTicketDetails = async (ticketId: string): Promise<Ticket> => {
  const response = await api.get(`/api/tickets/${ticketId}/`);
  return response.data.ticket;
};

export const getAllTickets = async (): Promise<Ticket[]> => {
  const response = await api.get("/api/tickets/all/");
  return response.data.tickets;
};

export const getTicketSuggestions = async (ticketId: string) => {
  const response = await api.post(`/api/tickets/${ticketId}/suggest/`);
  return response.data;
};

export const processTicket = async (ticketId: string, data: any): Promise<Ticket> => {
  const response = await api.post(`/api/tickets/${ticketId}/process/`, data);
  return response.data.ticket;
};