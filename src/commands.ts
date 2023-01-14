import {
	GetCommand,
	DynamoDBDocumentClient,
	GetCommandInput,
	QueryCommand,
	QueryCommandInput,
	PutCommandInput,
	PutCommand,
	UpdateCommandInput,
	UpdateCommand,
	DeleteCommandInput,
	DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DeleteResult, GetResult, PutResult, QueryResult, Result, UpdateResult } from './results';
import type { Table } from './table';

export abstract class Command<Input extends {}, Res extends Result<unknown, unknown>> {
	input: Input;
	db: DynamoDBDocumentClient;
	table: Table;
	constructor(db: DynamoDBDocumentClient, input: Input, table: Table) {
		this.input = input;
		this.db = db;
		this.table = table;
	}

	options(options: Partial<Input>): Command<Input, Res> {
		Object.assign(this.input, options);
		return this;
	}

	abstract send(): Promise<Res>;
}

export class GetItemCommand extends Command<GetCommandInput, GetResult> {
	async send(): Promise<GetResult> {
		// console.log(
		// 	'ORM: Executing Get Item command with input: ',
		// 	JSON.stringify(this.input, (_k, v) => (v === undefined ? '!!! WARNING UNDEFINED' : v), 4),
		// );
		const output = await this.db.send(new GetCommand(this.input));
		return new GetResult(output, this.table);
	}
}

export class QueryItemsCommand extends Command<QueryCommandInput, QueryResult> {
	async send(): Promise<QueryResult> {
		// TODO: verify primary keys vs selected index

		// console.log(
		// 	'ORM: Executing Query Items command with input: ',
		// 	JSON.stringify(this.input, (_k, v) => (v === undefined ? '!!! WARNING UNDEFINED' : v), 4),
		// );

		const output = await this.db.send(new QueryCommand(this.input));
		return new QueryResult(output, this.table);
	}

	index(indexName: string): QueryItemsCommand {
		if (!Object.keys(this.table.config().indexes || []).includes(indexName)) {
			throw new Error(`Index ${indexName} is not defined on the table`);
		}
		Object.assign(this.input, {
			IndexName: indexName,
		});
		return this;
	}
	//TODO filters, pagination etc.
}

export class PutItemCommand extends Command<PutCommandInput, PutResult> {
	async send(): Promise<PutResult> {
		// console.log(
		// 	'ORM: Executing Put Item command with input: ',
		// 	JSON.stringify(this.input, (_k, v) => (v === undefined ? '!!! WARNING UNDEFINED' : v), 4),
		// );

		const output = await this.db.send(new PutCommand(this.input));
		return new PutResult(output, this.table);
	}

	returnOld(): PutItemCommand {
		Object.assign(this.input, {
			ReturnValues: 'ALL_OLD',
		});
		return this;
	}
	//TODO condition etc
}

export class UpdateItemCommand extends Command<UpdateCommandInput, UpdateResult> {
	async send(): Promise<UpdateResult> {
		// console.log(
		// 	'ORM: Executing Update Item command with input: ',
		// 	JSON.stringify(this.input, (_k, v) => (v === undefined ? '[[undefined]]' : v), 4),
		// );

		const output = await this.db.send(new UpdateCommand(this.input));
		return new UpdateResult(output, this.table);
	}
	//TODO condition etc
}

export class DeleteItemCommand extends Command<DeleteCommandInput, DeleteResult> {
	async send(): Promise<DeleteResult> {
		// console.log(
		// 	'ORM: Executing Delete Item command with input: ',
		// 	JSON.stringify(this.input, (_k, v) => (v === undefined ? '!!! WARNING UNDEFINED' : v), 4),
		// );

		const output = await this.db.send(new DeleteCommand(this.input));
		return new DeleteResult(output, this.table);
	}
	//TODO condition etc
}
