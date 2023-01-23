import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Command, Result } from './commands/base';
import { EntityConfig, defineEntity, EntityRecord, Entity } from './entity';
import { TableConfig, defineTable, Table } from './table';

let dbClient: DbClient;

export interface DbClient {
	defineTable(config: TableConfig): Table;
	defineEntity<T extends object>(config: EntityConfig<T & EntityRecord>): Entity<T>;
	send<Cmd, Output>(cmd: Cmd): Promise<Output>;
}

export const connect = (region: string): DbClient => {
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
		return defineTable(this, config);
	}

	defineEntity<T extends object>(config: EntityConfig<T & EntityRecord>): Entity<T> {
		return defineEntity(config);
	}

	async send<Cmd, Output>(cmd: Cmd): Promise<Output> {
		// TODO better typing needed
		return (await this.db.send(cmd as never)) as Output;
	}

	batchWrite(): void {}
	batchRead(): void {}

	transactWrite(): void {}
	transactRead(): void {}
}
