import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Mock, vi } from 'vitest';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DbClient, ORMClient } from './client';
import { EntityConfig, defineEntity, EntityRecord, Entity } from './entity';
import { TableConfig, Table, UpdateData } from './table';
import { GetItemCommand } from './commands/get';
import { DeleteItemCommand } from './commands/delete';
import { PutItemCommand } from './commands/put';
import { QueryItemsCommand } from './commands/query';
import { UpdateItemCommand } from './commands/update';

let dbClient: MockORMClient;

export const connect = (region: string): MockORMClient => {
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
		dbClient = new MockORMClient(dynamoClient);
	}

	return dbClient;
};

export class MockORMClient extends ORMClient {
	DbClientSendMock = vi.fn().mockImplementation(() => {
		// do nothing. Returned values should be mocked in tests
	});

	GetItemCommandMock = vi
		.fn<[DbClient, Table, Record<string, string>], GetItemCommand>()
		.mockImplementation((...args: [DbClient, Table, Record<string, string>]) => new GetItemCommand(...args));
	PutItemCommandMock = vi
		.fn<[DbClient, Table, Record<string, string>], PutItemCommand>()
		.mockImplementation((...args: [DbClient, Table, Record<string, string>]) => new PutItemCommand(...args));
	UpdateItemCommandMock = vi
		.fn<[DbClient, Table, Record<string, string>, UpdateData], UpdateItemCommand>()
		.mockImplementation((...args: [DbClient, Table, Record<string, string>, UpdateData]) => new UpdateItemCommand(...args));

	DeleteItemCommandMock = vi
		.fn<[DbClient, Table, Record<string, string>], DeleteItemCommand>()
		.mockImplementation((...args: [DbClient, Table, Record<string, string>]) => new DeleteItemCommand(...args));
	QueryItemsCommandMock = vi
		.fn<[DbClient, Table, string, Record<string, any>], QueryItemsCommand>()
		.mockImplementation((...args: [DbClient, Table, string, Record<string, any>]) => new QueryItemsCommand(...args));

	constructor(db: DynamoDBDocumentClient) {
		super(db);
		this.db.send = this.DbClientSendMock; // overwrite original send with a mock
	}
	clearMocks() {
		(this.db.send as any).mockReset();
		this.GetItemCommandMock.mockClear();
		this.PutItemCommandMock.mockClear();
		this.UpdateItemCommandMock.mockClear();
		this.DeleteItemCommandMock.mockClear();
		this.QueryItemsCommandMock.mockClear();
	}

	defineTable(config: TableConfig): Table {
		return new Table(this, config, {
			GetItemCommand: this.GetItemCommandMock,
			PutItemCommand: this.PutItemCommandMock,
			UpdateItemCommand: this.UpdateItemCommandMock,
			DeleteItemCommand: this.DeleteItemCommandMock,
			QueryItemsCommand: this.QueryItemsCommandMock,
		});
	}
}
