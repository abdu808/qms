import { prisma } from '../db.js';
import { emitWebhookStrict, isWebhookDeliveryEnabled } from '../lib/webhookEmitter.js';

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, '');
  return digits || null;
}

function preferredChannels(recipient = {}) {
  const channels = [];
  if (recipient.phone) {
    channels.push('WHATSAPP', 'SMS');
  }
  if (recipient.email) {
    channels.push('EMAIL');
  }
  return channels;
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '{}';
  }
}

export async function dispatchIntegrationEvent({
  event,
  eventKey,
  title,
  message,
  recipient,
  entityType,
  entityId,
  link,
  data = {},
}) {
  if (!event || !eventKey || !title || !message) {
    throw new Error('event, eventKey, title and message are required');
  }

  const normalizedRecipient = {
    id: recipient?.id || null,
    name: recipient?.name || null,
    email: recipient?.email || null,
    phone: normalizePhone(recipient?.phone),
    role: recipient?.role || null,
  };

  const payload = {
    event,
    eventKey,
    title,
    message,
    entity: { type: entityType || null, id: entityId || null, link: link || null },
    recipient: {
      ...normalizedRecipient,
      preferredChannels: preferredChannels(normalizedRecipient),
    },
    data,
  };

  const delivery = await prisma.integrationDelivery.upsert({
    where: { eventKey },
    create: {
      event,
      eventKey,
      status: 'PENDING',
      channel: 'N8N',
      recipientUserId: normalizedRecipient.id,
      recipientName: normalizedRecipient.name,
      recipientEmail: normalizedRecipient.email,
      recipientPhone: normalizedRecipient.phone,
      recipientRole: normalizedRecipient.role,
      entityType: entityType || null,
      entityId: entityId || null,
      title,
      message,
      link: link || null,
      payloadJson: safeJson(payload),
    },
    update: {
      payloadJson: safeJson(payload),
      title,
      message,
      recipientName: normalizedRecipient.name,
      recipientEmail: normalizedRecipient.email,
      recipientPhone: normalizedRecipient.phone,
      recipientRole: normalizedRecipient.role,
    },
  });

  if (['DISPATCHED', 'DELIVERED'].includes(delivery.status)) {
    return { ok: true, skipped: true, delivery };
  }

  if (!(await isWebhookDeliveryEnabled())) {
    const updated = await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'SKIPPED',
        error: 'n8n webhook is not enabled or URL is missing',
      },
    });
    return { ok: true, skipped: true, delivery: updated };
  }

  try {
    const result = await emitWebhookStrict(event, {
      ...payload,
      deliveryId: delivery.id,
    });

    const updated = await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.ok ? 'DISPATCHED' : 'FAILED',
        dispatchedAt: result.ok ? new Date() : null,
        failedAt: result.ok ? null : new Date(),
        responseJson: safeJson(result),
        error: result.ok ? null : `n8n returned status ${result.status}`,
      },
    });

    return { ok: result.ok, skipped: false, delivery: updated };
  } catch (e) {
    const updated = await prisma.integrationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        error: e.message || 'Integration dispatch failed',
      },
    });
    return { ok: false, skipped: false, delivery: updated, error: e.message };
  }
}

export async function markIntegrationDeliveryStatus({
  deliveryId,
  eventKey,
  status,
  channel,
  provider,
  providerMessageId,
  response,
  error,
}) {
  const where = deliveryId ? { id: deliveryId } : { eventKey };
  const finalStatus = String(status || '').toUpperCase();
  if (!['PENDING', 'DISPATCHED', 'DELIVERED', 'FAILED', 'SKIPPED'].includes(finalStatus)) {
    throw new Error('Invalid delivery status');
  }

  const now = new Date();
  return prisma.integrationDelivery.update({
    where,
    data: {
      status: finalStatus,
      channel: channel || undefined,
      provider: provider || undefined,
      providerMessageId: providerMessageId || undefined,
      responseJson: response !== undefined ? safeJson(response) : undefined,
      error: error || undefined,
      dispatchedAt: finalStatus === 'DISPATCHED' ? now : undefined,
      deliveredAt: finalStatus === 'DELIVERED' ? now : undefined,
      failedAt: finalStatus === 'FAILED' ? now : undefined,
    },
  });
}
