import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Command, Result } from './commands/base';
import { DeleteItemCommand } from './commands/delete';
import { GetItemCommand } from './commands/get';
import { PutItemCommand } from './commands/put';
import { QueryItemsCommand } from './commands/query';
import { UpdateItemCommand } from './commands/update';
import { EntityConfig, defineEntity, EntityRecord, Entity } from './entity';
import { TableConfig, Table } from './table';

let dbClient: ORMClient;

export interface DbClient {
	defineTable(config: TableConfig): Table;
	defineEntity<T extends object>(config: EntityConfig<T & EntityRecord>): Entity<T>;
	send<Cmd, Output>(cmd: Cmd): Promise<Output>;
	sendCommand<Input, DbCommand, Output, Res extends Result<Output>, Cmd extends Command<Input, DbCommand, Output, Res>>(
		command: Cmd,
	): Promise<Res>;
	dbClient(): DynamoDBDocumentClient;
}

export const connect = (region: string): ORMClient => {
	if (!dbClient) {
		const dynamoClient = DynamoDBDocumentClient.from(
			new DynamoDBClient({
				region: region,
			}),
			{
				marshallOptions: {
					removeUndefinedValues: true,
				},
			},
		);

		dbClient = new ORMClient(dynamoClient);
	}

	return dbClient;
};

export class ORMClient implements DbClient {
	db: DynamoDBDocumentClient;
	constructor(db: DynamoDBDocumentClient) {
		this.db = db;
	}

	defineTable(config: TableConfig): Table {
		return new Table(this, config, {
			GetItemCommand,
			UpdateItemCommand,
			QueryItemsCommand,
			DeleteItemCommand,
			PutItemCommand,
		});
	}

	dbClient(): DynamoDBDocumentClient {
		return this.db;
	}

	defineEntity<T extends object>(config: EntityConfig<T & EntityRecord>): Entity<T> {
		return defineEntity(config);
	}

	async send<Cmd, Output>(cmd: Cmd): Promise<Output> {
		// TODO better typing needed
		return (await this.db.send(cmd as never)) as Output;
	}

	async sendCommand<Input, DbCommand, Output, Res extends Result<Output>, Cmd extends Command<Input, DbCommand, Output, Res>>(
		command: Cmd,
	): Promise<Res> {
		const output: Output = await this.send(command.command());
		return command.result(output);
	}

	batchWrite(): void {}
	batchRead(): void {}

	transactWrite(): void {}
	transactRead(): void {}
}
