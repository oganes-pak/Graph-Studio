#!/usr/bin/env node
/** Optional MCP-sidecar. Browser tools use the same simple names. */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { ProjectStore, mergeObjects } from './project-store.mjs';

const DIR=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(DIR,'..');
const store=new ProjectStore();
const server=new McpServer({name:'graph-studio',version:'8.0.0'});
const id=z.string().min(1).regex(/^[A-Za-zА-Яа-яЁё0-9_-]+$/);
const color=z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const nodeChanges=z.object({type:z.enum(['core','group','node','accent','default']).optional(),name:z.string().min(1).optional(),description:z.string().optional(),color:color.optional(),size:z.number().min(3).max(100).optional()}).strict();
const connectionChanges=z.object({label:z.string().optional(),description:z.string().optional(),color:color.optional(),width:z.number().min(.5).max(20).optional()}).strict();

const response=(value)=>({content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value});
const failure=(error)=>({content:[{type:'text',text:`Ошибка Graph Studio: ${error.message}`}],isError:true});
function register(name,definition,handler){server.registerTool(name,definition,async(args)=>{try{return response(await handler(args));}catch(error){return failure(error);}});}

register('get_project',{title:'Получить граф',description:'Читает текущий проект перед изменениями.',inputSchema:z.object({}).strict()},()=>store.read());
register('replace_graph',{title:'Заменить граф',description:'Полностью заменяет узлы и связи.',inputSchema:z.object({nodes:z.array(z.record(z.string(),z.unknown())),connections:z.array(z.record(z.string(),z.unknown()))}).strict()},({nodes,connections})=>store.mutate(project=>{project.data={nodes,links:connections.map(normalizeConnection)};return project;}));
register('add_node',{title:'Добавить узел',description:'Добавляет один узел с уникальным id.',inputSchema:z.object({id,type:z.enum(['core','group','node','accent','default']).default('node'),name:z.string().min(1),description:z.string().default(''),color:color.optional(),size:z.number().min(3).max(100).optional()}).strict()},node=>store.mutate(project=>{if(project.data.nodes.some(item=>item.id===node.id))throw new Error(`Узел ${node.id} уже существует.`);project.data.nodes.push(node);return node;}));
register('change_node',{title:'Изменить узел',description:'Меняет свойства существующего узла.',inputSchema:z.object({id,changes:nodeChanges}).strict()},({id:nodeId,changes})=>store.mutate(project=>{const node=project.data.nodes.find(item=>item.id===nodeId);if(!node)throw new Error(`Узел ${nodeId} не найден.`);Object.assign(node,changes);return node;}));
register('delete_node',{title:'Удалить узел',description:'Удаляет узел и его связи.',inputSchema:z.object({id}).strict()},({id:nodeId})=>store.mutate(project=>{const before=project.data.nodes.length;project.data.nodes=project.data.nodes.filter(item=>item.id!==nodeId);if(project.data.nodes.length===before)throw new Error(`Узел ${nodeId} не найден.`);project.data.links=project.data.links.filter(link=>link.source!==nodeId&&link.target!==nodeId);return{removed:nodeId};}));
register('add_connection',{title:'Добавить связь',description:'Соединяет два существующих узла. Пара должна быть уникальной независимо от направления.',inputSchema:z.object({from:id,to:id,label:z.string().default(''),description:z.string().default(''),color:color.optional(),width:z.number().min(.5).max(20).optional()}).strict()},args=>store.mutate(project=>{const link=normalizeConnection(args);const ids=new Set(project.data.nodes.map(node=>node.id));if(!ids.has(link.source)||!ids.has(link.target))throw new Error('Оба узла связи должны существовать.');if(project.data.links.some(item=>samePair(item.source,item.target,link.source,link.target)))throw new Error(`Связь между ${link.source} и ${link.target} уже существует.`);project.data.links.push(link);return link;}));
register('change_connection',{title:'Изменить связь',description:'Меняет подпись, описание, цвет или толщину.',inputSchema:z.object({from:id,to:id,changes:connectionChanges}).strict()},({from,to,changes})=>store.mutate(project=>{const link=project.data.links.find(item=>samePair(item.source,item.target,from,to));if(!link)throw new Error(`Связь ${from} → ${to} не найдена.`);Object.assign(link,changes);return link;}));
register('delete_connection',{title:'Удалить связь',description:'Удаляет указанную связь.',inputSchema:z.object({from:id,to:id}).strict()},({from,to})=>store.mutate(project=>{const before=project.data.links.length;project.data.links=project.data.links.filter(link=>!samePair(link.source,link.target,from,to));if(project.data.links.length===before)throw new Error(`Связь ${from} → ${to} не найдена.`);return{removed:{from,to}};}));
register('set_layout',{title:'Выбрать раскладку',description:'Выбирает паутину или соты.',inputSchema:z.object({layout:z.enum(['planetary','hex'])}).strict()},({layout})=>store.mutate(project=>{project.config.layout=mergeObjects(project.config.layout,{type:layout});return project.config.layout;}));
register('change_view',{title:'Изменить внешний вид',description:'Глубоко объединяет настройки с текущей конфигурацией.',inputSchema:z.object({changes:z.record(z.string(),z.unknown())}).strict()},({changes})=>store.mutate(project=>{project.config=mergeObjects(project.config,changes);return project.config;}));
register('set_read_only',{title:'Режим только просмотра',description:'Включает или отключает запрет изменений.',inputSchema:z.object({enabled:z.boolean()}).strict()},({enabled})=>store.mutate(project=>{project.config.editor=mergeObjects(project.config.editor,{locked:enabled,mode:enabled?'viewer':'admin',uiVisible:!enabled,allowHoverEditor:!enabled});return project.config.editor;},{allowWhenLocked:true}));
register('add_legend_item',{title:'Добавить пункт легенды',description:'Добавляет одно обозначение.',inputSchema:z.object({id,label:z.string().min(1),color,shape:z.enum(['circle','square','diamond']).default('circle')}).strict()},item=>store.mutate(project=>{const items=project.config.legend.items;if(items.some(entry=>entry.id===item.id))throw new Error(`Пункт ${item.id} уже существует.`);items.push(item);return item;}));
register('delete_legend_item',{title:'Удалить пункт легенды',description:'Удаляет обозначение по id.',inputSchema:z.object({id}).strict()},({id:itemId})=>store.mutate(project=>{const before=project.config.legend.items.length;project.config.legend.items=project.config.legend.items.filter(item=>item.id!==itemId);if(project.config.legend.items.length===before)throw new Error(`Пункт ${itemId} не найден.`);return{removed:itemId};}));

server.registerResource('graph-project','graphstudio://project/current',{title:'Текущий проект',description:'Узлы, связи и конфигурация.',mimeType:'application/json'},async uri=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(await store.read(),null,2)}]}));
server.registerResource('graph-tools','graphstudio://contracts/tools',{title:'Простые команды',description:'Те же команды доступны без MCP в window.graph.run().',mimeType:'application/json'},async uri=>({contents:[{uri:uri.href,mimeType:'application/json',text:await readFile(resolve(ROOT,'model/graph-tools.json'),'utf8')}]}));
server.registerResource('ai-plan','graphstudio://contracts/ai-plan',{title:'JSON-план для ИИ',description:'Декларативный формат graph-studio/1.',mimeType:'application/json'},async uri=>({contents:[{uri:uri.href,mimeType:'application/json',text:await readFile(resolve(ROOT,'model/ai-plan-schema.json'),'utf8')}]}));
server.registerResource('module-map','graphstudio://modules/map',{title:'Карта модулей',description:'Ответственность файлов.',mimeType:'text/markdown'},async uri=>({contents:[{uri:uri.href,mimeType:'text/markdown',text:await readFile(resolve(ROOT,'MODULES.md'),'utf8')}]}));

server.registerPrompt('edit-graph-safely',{title:'Безопасно изменить граф',description:'Одна атомарная команда и проверка результата.',argsSchema:{request:z.string().min(1)}},({request})=>({messages:[{role:'user',content:{type:'text',text:[`Задача: ${request}`,'1. Вызови get_project.','2. Проверь id и режим read-only.','3. Выполни одну минимальную команду: add_node, change_node, add_connection и т.п.','4. Снова вызови get_project и проверь результат.'].join('\n')}}]}));
server.registerPrompt('build-graph-from-text',{title:'Построить граф из текста',description:'Создать нейтральный граф без выдуманных оценок.',argsSchema:{sourceText:z.string().min(1)}},({sourceText})=>({messages:[{role:'user',content:{type:'text',text:[`Исходный текст: ${sourceText}`,'Создай одно ядро, логические группы и узлы.','Используй короткие стабильные id.','Сначала добавь все узлы, затем связи.','Не придумывай положительную или отрицательную оценку.'].join('\n')}}]}));

function normalizeConnection(value){return{source:value.from??value.source,target:value.to??value.target,label:value.label??'',description:value.description??'',...(value.color?{color:value.color}:{}),...(value.width!=null?{width:Number(value.width)}:{})};}
function samePair(a,b,c,d){return(a===c&&b===d)||(a===d&&b===c);}
async function main(){await store.ensure();await server.connect(new StdioServerTransport());console.error(`[graph-studio-mcp] ready; project=${store.filePath}`);}
main().catch(error=>{console.error('[graph-studio-mcp] fatal:',error);process.exitCode=1;});
