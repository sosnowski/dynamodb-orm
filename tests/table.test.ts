import { describe, beforeEach, it, expect, vi } from 'vitest';
import { connect } from 'src/client';
import { defineTable, Table } from 'src/table';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { defineEntity } from 'src/entity';
import { DeleteItemCommand, GetItemCommand, PutItemCommand, QueryItemsCommand, UpdateItemCommand } from 'src/commands';

type Test = {
	id: string;
	name: string;
	orgId: string;
	smth?: string;
	email?: string;
	pk?: string;
	sk?: string;
};

const dbClient = connect('eu-west-1');
const TestEntity = defineEntity<Test>({
	name: 'TEST',
	computed: {
		pk: {
			dependsOn: ['id'],
			get: (item) => `TEST#${item.id}`,
		},
		sk: {
			dependsOn: ['email'],
			get: (item) => (item.email ? `EMAIL#${item.email}` : undefined),
		},
	},
});

describe('Table instance creation', () => {
	let table: Table;

	beforeEach(() => {
		table = defineTable(dbClient, {
			name: 'TestTable',
			primaryKey: 'pk',
			sortKey: 'sk',
			entities: [TestEntity],
		});
	});

	it('Should create a valid table instance', () => {
		expect(table).toBeInstanceOf(Table);
	});

	it('Should return DynamoDB Client', () => {
		expect(table.dbClient()).toBeInstanceOf(DynamoDBDocumentClient);
	});
});

describe('Table operations', () => {
	const GetItemCommandMock = vi.fn().mockImplementation((...args: [any, any, any]) => new GetItemCommand(...args));
	const PutItemCommandMock = vi.fn().mockImplementation((...args: [any, any, any]) => new PutItemCommand(...args));
	const UpdateItemCommandMock = vi.fn().mockImplementation((...args: [any, any, any]) => new UpdateItemCommand(...args));
	const DeleteItemCommandMock = vi.fn().mockImplementation((...args: [any, any, any]) => new DeleteItemCommand(...args));
	const QueryItemsCommandMock = vi.fn().mockImplementation((...args: [any, any, any]) => new QueryItemsCommand(...args));

	const table = new Table(
		dbClient,
		{
			name: 'TestTable',
			primaryKey: 'pk',
			sortKey: 'sk',
			indexes: {
				ByEmail: {
					primaryKey: 'orgId',
					sortKey: 'email',
				},
			},
			entities: [TestEntity],
		},
		{
			GetItemCommand: GetItemCommandMock,
			PutItemCommand: PutItemCommandMock,
			UpdateItemCommand: UpdateItemCommandMock,
			DeleteItemCommand: DeleteItemCommandMock,
			QueryItemsCommand: QueryItemsCommandMock,
		},
	);

	const tableNoSortKey = new Table(
		dbClient,
		{
			name: 'TestTableNoSort',
			primaryKey: 'pk',
			indexes: {
				ByEmail: {
					primaryKey: 'orgId',
					sortKey: 'email',
				},
			},
			entities: [TestEntity],
		},
		{
			GetItemCommand: GetItemCommandMock,
			PutItemCommand: PutItemCommandMock,
			UpdateItemCommand: UpdateItemCommandMock,
			DeleteItemCommand: DeleteItemCommandMock,
			QueryItemsCommand: QueryItemsCommandMock,
		},
	);

	beforeEach(() => {
		GetItemCommandMock.mockClear();
		PutItemCommandMock.mockClear();
		UpdateItemCommandMock.mockClear();
		DeleteItemCommandMock.mockClear();
		QueryItemsCommandMock.mockClear();
	});

	describe('Get Command', () => {
		it('Should return a GetCommand on get() operation', () => {
			const cmd = table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(GetItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(GetItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(GetItemCommandMock.mock.lastCall![0]).toBeInstanceOf(DynamoDBDocumentClient);
		});

		it('Should throw error about missing sortKey', () => {
			expect(() => {
				table.get({
					primaryKey: 'pkvalue',
				});
			}).toThrowError();
		});

		it('Should provide GetCommand with a valid primaryKey if table does not have sortKey', () => {
			tableNoSortKey.get({
				primaryKey: 'pkvalue',
			});

			expect(GetItemCommandMock.mock.lastCall![1]).toEqual({
				TableName: 'TestTableNoSort',
				Key: {
					pk: 'pkvalue',
				},
			});
		});

		it('Should provide GetCommand with a valid table name', () => {
			table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(GetItemCommandMock.mock.lastCall![1].TableName).toBe('TestTable');
		});

		it('Should provide GetCommand with a valid primaryKey and sortKey', () => {
			table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(GetItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'pkvalue',
				sk: 'skvalue',
			});
		});
	});

	describe('Put Command', () => {
		let record: ReturnType<typeof TestEntity>;

		beforeEach(() => {
			record = TestEntity({
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
			});
		});
		it('Should return a PutCommand on put() operation', () => {
			const cmd = table.put(record);

			expect(PutItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(PutItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.put(record);

			expect(PutItemCommandMock.mock.lastCall![0]).toBeInstanceOf(DynamoDBDocumentClient);
		});

		it('Should provide PutCommand with a valid TableName', () => {
			table.put(record);

			expect(PutItemCommandMock.mock.lastCall![1].TableName).toBe('TestTable');
		});

		it('Should provide PutCommand with the marshalled Item', () => {
			table.put(record);

			const createdIso = record._created.toISOString();
			const updatedIso = record._updated.toISOString();

			expect(PutItemCommandMock.mock.lastCall![1].Item).toEqual({
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
				_created: createdIso,
				_updated: updatedIso,
				_type: 'TEST',
				_ttl: undefined,
			});
		});
	});

	describe('Delete Command', () => {
		let record: ReturnType<typeof TestEntity>;

		beforeEach(() => {
			record = TestEntity({
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
			});
		});

		it('Should return a DeleteItemCommand on delete() operation', () => {
			const cmd = table.delete(record);

			expect(DeleteItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(DeleteItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.delete(record);

			expect(DeleteItemCommandMock.mock.lastCall![0]).toBeInstanceOf(DynamoDBDocumentClient);
		});

		it('Should provide DelteItemCommand with a valid table name', () => {
			table.delete(record);

			expect(DeleteItemCommandMock.mock.lastCall![1].TableName).toBe('TestTable');
		});

		it('Should provide DelteItemCommand with a valid composite record Key', () => {
			table.delete(record);

			expect(DeleteItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			});
		});

		it('Should provide DelteItemCommand with a valid record partitionKey if Table has no sortKey', () => {
			tableNoSortKey.delete(record);

			expect(DeleteItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'TEST#12345',
			});
		});

		it('Should throw error if Table has a sortKey defined but record does not', () => {
			delete record.email;
			expect(() => {
				table.delete(record);
			}).toThrowError();
		});
	});

	describe('DeleteById Command', () => {
		it('Should return a DeleteItemCommand on delete() operation', () => {
			const cmd = table.deleteById({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(DeleteItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(DeleteItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.deleteById({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(DeleteItemCommandMock.mock.lastCall![0]).toBeInstanceOf(DynamoDBDocumentClient);
		});

		it('Should provide DelteItemCommand with a valid table name', () => {
			table.deleteById({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(DeleteItemCommandMock.mock.lastCall![1].TableName).toBe('TestTable');
		});

		it('Should provide DelteItemCommand with a valid composite record Key', () => {
			table.deleteById({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(DeleteItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'pkvalue',
				sk: 'skvalue',
			});
		});

		it('Should provide DelteItemCommand with a valid record partitionKey if Table has no sortKey', () => {
			tableNoSortKey.deleteById({
				primaryKey: 'pkvalue',
			});

			expect(DeleteItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'pkvalue',
			});
		});

		it('Should throw error if Table has a sortKey defined but record does not', () => {
			expect(() => {
				table.deleteById({
					primaryKey: 'pkvalue',
				});
			}).toThrowError();
		});
	});

	describe('Query command', () => {
		it('Should return a QueryItemsCommand on query() operation', () => {
			const cmd = table.query('#pk = :pk', { pk: 'some-value' });

			expect(QueryItemsCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(QueryItemsCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.query('#pk = :pk', { pk: 'some-value' });

			expect(QueryItemsCommandMock.mock.lastCall![0]).toBeInstanceOf(DynamoDBDocumentClient);
		});

		it('Should provide QueryItemsCommand with a valid table name', () => {
			table.query('#pk = :pk', { pk: 'some-value' });

			expect(QueryItemsCommandMock.mock.lastCall![1].TableName).toBe('TestTable');
		});

		it('Should provide QueryItemsCommand with a valid condition expression', () => {
			table.query('#pk = :pk', { pk: 'some-value' });

			expect(QueryItemsCommandMock.mock.lastCall![1].KeyConditionExpression).toBe('#pk = :pk');
		});

		it('Should provide QueryItemsCommand with a set of ExpressionAttributesNames', () => {
			table.query('#pk = :pk AND begins_with(#sk, :sk)', { pk: 'some-value', sk: 'some-sk' });

			expect(QueryItemsCommandMock.mock.lastCall![1].ExpressionAttributeNames).toEqual({
				'#pk': 'pk',
				'#sk': 'sk',
			});
		});

		it('Should provide QueryItemsCommand with a set of ExpressionAttributesValues', () => {
			table.query('#pk = :pk AND begins_with(#sk, :sk)', { pk: 'some-value', sk: 'some-sk' });

			expect(QueryItemsCommandMock.mock.lastCall![1].ExpressionAttributeValues).toEqual({
				':pk': 'some-value',
				':sk': 'some-sk',
			});
		});
	});

	describe('Update command', () => {
		let record: ReturnType<typeof TestEntity>;

		beforeEach(() => {
			record = TestEntity({
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
				smth: 'something',
			});
		});

		it('Should return a UpdateItemCommand on update() operation', () => {
			const cmd = table.update(record);

			expect(UpdateItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(UpdateItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			record.name = 'Gucio';
			delete record.smth;

			table.update(record);

			expect(UpdateItemCommandMock.mock.lastCall![0]).toBeInstanceOf(DynamoDBDocumentClient);
		});

		it('Should provide UpdateItemCommand with a valid table name', () => {
			record.name = 'Gucio';
			delete record.smth;

			table.update(record);

			expect(UpdateItemCommandMock.mock.lastCall![1].TableName).toBe('TestTable');
		});

		it('Should provide UpdateItemCommand with a valid composite record key', () => {
			record.name = 'Gucio';
			table.update(record);

			expect(UpdateItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			});
		});

		it('Should provide UpdateItemCommand with a valid partitionKey if table has no sort key', () => {
			const record = TestEntity({
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				smth: 'something',
			});

			record.name = 'Gucio';

			tableNoSortKey.update(record);

			expect(UpdateItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'TEST#12345',
			});
		});

		it('Should throw error if record is missing required sort key', () => {
			const record = TestEntity({
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				smth: 'something',
			});

			expect(() => {
				table.update(record);
			}).toThrowError();
		});

		it('Should provide UpdateItemCommand with a valid UpdateExpression', () => {
			record.name = 'Gucio';
			delete record.smth;

			table.update(record);

			expect(UpdateItemCommandMock.mock.lastCall![1].UpdateExpression).toBe('SET #name = :name, #_updated = :_updated REMOVE #smth');
		});

		it('Should provide UpdateItemCommand with a set of ExpressionAttributesNames', () => {
			record.name = 'Gucio';
			delete record.smth;

			table.update(record);

			expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeNames).toEqual({
				'#name': 'name',
				'#smth': 'smth',
				'#_updated': '_updated',
			});
		});

		it('Should provide UpdateItemCommand with a set of marshalled ExpressionAttributesValues', () => {
			record.name = 'Gucio';
			delete record.smth;
			table.update(record);

			const updatedIso = record._updated.toISOString();

			expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeValues).toEqual({
				':name': 'Gucio',
				':_updated': updatedIso,
			});
		});
	});

	describe('UpdateById command', () => {
		it('Should return a UpdateItemCommand on update() operation', () => {
			const updated = new Date();
			const cmd = table.updateById(
				{
					primaryKey: 'pk-value',
					sortKey: 'sk-value',
				},
				{
					set: { name: 'Gucio', _updated: updated },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(UpdateItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			const updated = new Date();
			table.updateById(
				{
					primaryKey: 'pk-value',
					sortKey: 'sk-value',
				},
				{
					set: { name: 'Gucio', _updated: updated },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock.mock.lastCall![0]).toBeInstanceOf(DynamoDBDocumentClient);
		});

		it('Should provide UpdateItemCommand with a valid table name', () => {
			const updated = new Date();
			table.updateById(
				{
					primaryKey: 'pk-value',
					sortKey: 'sk-value',
				},
				{
					set: { name: 'Gucio', _updated: updated },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock.mock.lastCall![1].TableName).toBe('TestTable');
		});

		it('Should provide UpdateItemCommand with a valid record key', () => {
			const updated = new Date();
			table.updateById(
				{
					primaryKey: 'pk-value',
					sortKey: 'sk-value',
				},
				{
					set: { name: 'Gucio', _updated: updated },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'pk-value',
				sk: 'sk-value',
			});
		});

		it('Should provide UpdateItemCommand with a simple partitionKey if table does not have sortKey', () => {
			tableNoSortKey.updateById(
				{
					primaryKey: 'pk-value',
				},
				{
					set: { name: 'Gucio' },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock.mock.lastCall![1].Key).toEqual({
				pk: 'pk-value',
			});
		});

		it('Should throw error if sortKey is not provided and table requires it', () => {
			expect(() => {
				table.updateById(
					{
						primaryKey: 'pk-value',
					},
					{
						set: { name: 'Gucio' },
						remove: ['smth'],
					},
				);
			}).toThrowError();
		});

		it('Should provide UpdateItemCommand with a valid UpdateExpression', () => {
			const updated = new Date();
			table.updateById(
				{
					primaryKey: 'pk-value',
					sortKey: 'sk-value',
				},
				{
					set: { name: 'Gucio', _updated: updated },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock.mock.lastCall![1].UpdateExpression).toBe('SET #name = :name, #_updated = :_updated REMOVE #smth');
		});

		it('Should provide UpdateItemCommand with a set of ExpressionAttributesNames', () => {
			const updated = new Date();
			table.updateById(
				{
					primaryKey: 'pk-value',
					sortKey: 'sk-value',
				},
				{
					set: { name: 'Gucio', _updated: updated },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeNames).toEqual({
				'#name': 'name',
				'#smth': 'smth',
				'#_updated': '_updated',
			});
		});

		it('Should provide UpdateItemCommand with a set of marshalled ExpressionAttributesValues', () => {
			const updated = new Date();
			table.updateById(
				{
					primaryKey: 'pk-value',
					sortKey: 'sk-value',
				},
				{
					set: { name: 'Gucio', _updated: updated },
					remove: ['smth'],
				},
			);

			expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeValues).toEqual({
				':name': 'Gucio',
				':_updated': updated.toISOString(),
			});
		});
	});
});
