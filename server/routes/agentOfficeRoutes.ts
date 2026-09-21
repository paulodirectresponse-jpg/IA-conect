import { Router } from 'express';
import { openAgentOfficeDatabase } from '../agent-office/database.js';
import { ProjectRepository } from '../agent-office/projectRepository.js';
import { ConversationRepository, MessageRepository } from '../agent-office/conversationRepository.js';
import { getAgentOfficeConfig, ensureAgentOfficeDataDir } from '../agent-office/config.js';

export const agentOfficeRouter = Router();

agentOfficeRouter.get('/agent-office/health', (_request, response) => {
  const config = getAgentOfficeConfig();
  try {
    ensureAgentOfficeDataDir(config);
    const database = openAgentOfficeDatabase(config);
    database.connection.prepare('SELECT 1 AS ok').get();
    database.connection.close();
    response.json({ ok: true, service: 'agent-office', storage: 'sqlite-wal', data_dir_configured: Boolean(config.dataDir), database_path_configured: Boolean(config.databasePath) });
  } catch (error) {
    response.status(503).json({ ok: false, service: 'agent-office', error: { code: 'LOCAL_STORAGE_UNAVAILABLE', message: error instanceof Error ? error.message : 'Local storage is unavailable.' } });
  }
});

agentOfficeRouter.get('/agent-office/projects', (_request, response) => {
  try {
    const database = openAgentOfficeDatabase();
    const projects = new ProjectRepository(database.connection).list();
    database.connection.close();
    response.json({ ok: true, data: projects });
  } catch (error) {
    response.status(500).json({ ok: false, error: { code: 'PROJECT_LIST_FAILED', message: error instanceof Error ? error.message : 'Unable to list projects.' } });
  }
});

agentOfficeRouter.post('/agent-office/projects', (request, response) => {
  try {
    const database = openAgentOfficeDatabase();
    const project = new ProjectRepository(database.connection).create({ name: request.body?.name, root_path: String(request.body?.root_path || '') });
    database.connection.close();
    response.status(201).json({ ok: true, data: project });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROJECT_CREATE_FAILED';
    const status = code === 'PROJECT_PATH_NOT_FOUND' || code === 'PROJECT_PATH_NOT_DIRECTORY' ? 400 : code === 'PROJECT_ALREADY_EXISTS' ? 409 : 500;
    response.status(status).json({ ok: false, error: { code, message: code === 'PROJECT_PATH_NOT_FOUND' ? 'Project folder does not exist.' : code === 'PROJECT_PATH_NOT_DIRECTORY' ? 'Project path is not a folder.' : code === 'PROJECT_ALREADY_EXISTS' ? 'This project folder is already registered.' : 'Unable to create project.' } });
  }
});

agentOfficeRouter.get('/agent-office/projects/:projectId/conversation', (request, response) => {
  try {
    const database = openAgentOfficeDatabase();
    const conversation = new ConversationRepository(database.connection).ensureForProject(request.params.projectId);
    const messages = new MessageRepository(database.connection).list(conversation, 200);
    database.connection.close();
    response.json({ ok: true, data: { conversation_id: conversation, messages } });
  } catch (error) {
    response.status(500).json({ ok: false, error: { code: 'CONVERSATION_FAILED', message: error instanceof Error ? error.message : 'Unable to load conversation.' } });
  }
});

agentOfficeRouter.post('/agent-office/projects/:projectId/messages', (request, response) => {
  try {
    const database = openAgentOfficeDatabase();
    const conversations = new ConversationRepository(database.connection);
    const conversationId = conversations.ensureForProject(request.params.projectId);
    const messages = new MessageRepository(database.connection);
    const message = messages.create({
      conversation_id: conversationId,
      role: request.body?.role || 'user',
      agent_id: request.body?.agent_id ?? null,
      content: String(request.body?.content || ''),
      metadata: request.body?.metadata,
    });
    database.connection.close();
    response.status(201).json({ ok: true, data: message });
  } catch (error) {
    response.status(500).json({ ok: false, error: { code: 'MESSAGE_FAILED', message: error instanceof Error ? error.message : 'Unable to save message.' } });
  }
});
