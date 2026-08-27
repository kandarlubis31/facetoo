import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.flatten().fieldErrors,
      },
    });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = error.meta?.['target'] as string[] | undefined;
      return reply.code(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `Unique constraint violated: ${target?.join(', ')}`,
        },
      });
    }
    if (error.code === 'P2025') {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found' },
      });
    }
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: error.validation,
      },
    });
  }

  // Default
  const statusCode = error.statusCode ?? 500;
  return reply.code(statusCode).send({
    success: false,
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'Internal server error' : error.message,
    },
  });
}