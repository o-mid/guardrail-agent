type Client = {
  userId: string;
  planId: string;
  res: import("express").Response;
};

const clients = new Set<Client>();

export function subscribe(userId: string, planId: string, res: import("express").Response): () => void {
  const client: Client = { userId, planId, res };
  clients.add(client);
  return () => {
    clients.delete(client);
  };
}

export function publishPlanEvent(userId: string, planId: string, event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (c.userId === userId && c.planId === planId) {
      c.res.write(payload);
    }
  }
}
