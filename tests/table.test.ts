import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';
import { connect, MockORMClient } from '../src/mock';
import { Table } from '../src/table';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeleteItemCommand } from '../src/commands/delete';
import { GetItemCommand } from '../src/commands/get';
import { PutItemCommand } from '../src/commands/put';
import { QueryItemsCommand } from '../src/commands/query';
import { UpdateItemCommand } from '../src/commands/update';

type Test = {
	id: string;
	name: string;
	orgId: string;
	smth?: string;
	email?: string;
	pk?: string;
	sk?: string;
};

const mockClient = connect('eu-west-1');
const TestEntity = mockClient.defineEntity<Test>({
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

const table = mockClient.defineTable({
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
});
const tableNoSortKey = mockClient.defineTable({
	name: 'TestTableNoSort',
	primaryKey: 'pk',
	indexes: {
		ByEmail: {
			primaryKey: 'orgId',
			sortKey: 'email',
		},
	},
	entities: [TestEntity],
});

afterEach(() => {
	mockClient.clearMocks();
});

describe('Table instance creation', () => {
	it('Should create a valid table instance', () => {
		expect(table).toBeInstanceOf(Table);
	});
});

describe('Table operations', () => {
	describe('Get Command', () => {
		it('Should return a GetCommand on get() operation', () => {
			const cmd = table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(mockClient.GetItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(GetItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(mockClient.GetItemCommandMock.mock.lastCall![0]).toBeInstanceOf(MockORMClient);
		});

		it('Should pass a Table instance to the Command', () => {
			table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(mockClient.GetItemCommandMock.mock.lastCall![1]).toBeInstanceOf(Table);
			expect(mockClient.GetItemCommandMock.mock.lastCall![1]).toBe(table);
		});

		it('Should pass a valid composite Key to the Command', () => {
			table.get({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(mockClient.GetItemCommandMock.mock.lastCall![2]).toEqual({
				pk: 'pkvalue',
				sk: 'skvalue',
			});
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

			expect(mockClient.GetItemCommandMock.mock.lastCall![2]).toEqual({
				pk: 'pkvalue',
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

			expect(mockClient.PutItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(PutItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.put(record);

			expect(mockClient.PutItemCommandMock.mock.lastCall![0]).toBeInstanceOf(MockORMClient);
		});

		it('Should pass a Table instance to the Command', () => {
			table.put(record);

			expect(mockClient.PutItemCommandMock.mock.lastCall![1]).toBeInstanceOf(Table);
			expect(mockClient.PutItemCommandMock.mock.lastCall![1]).toBe(table);
		});

		it('Should provide PutCommand with the marshalled Item', () => {
			table.put(record);

			const createdIso = record._created.toISOString();
			const updatedIso = record._updated.toISOString();

			expect(mockClient.PutItemCommandMock.mock.lastCall![2]).toEqual({
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

			expect(mockClient.DeleteItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(DeleteItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.delete(record);

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![0]).toBeInstanceOf(MockORMClient);
		});

		it('Should pass a Table instance to the Command', () => {
			table.delete(record);

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![1]).toBeInstanceOf(Table);
			expect(mockClient.DeleteItemCommandMock.mock.lastCall![1]).toBe(table);
		});

		it('Should provide DelteItemCommand with a valid composite record Key', () => {
			table.delete(record);

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![2]).toEqual({
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			});
		});

		it('Should provide DelteItemCommand with a valid record partitionKey if Table has no sortKey', () => {
			tableNoSortKey.delete(record);

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![2]).toEqual({
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

			expect(mockClient.DeleteItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(DeleteItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.deleteById({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![0]).toBeInstanceOf(MockORMClient);
		});

		it('Should pass a Table instance to the Command', () => {
			table.deleteById({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![1]).toBeInstanceOf(Table);
			expect(mockClient.DeleteItemCommandMock.mock.lastCall![1]).toBe(table);
		});

		it('Should provide DelteItemCommand with a valid composite record Key', () => {
			table.deleteById({
				primaryKey: 'pkvalue',
				sortKey: 'skvalue',
			});

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![2]).toEqual({
				pk: 'pkvalue',
				sk: 'skvalue',
			});
		});

		it('Should provide DelteItemCommand with a valid record partitionKey if Table has no sortKey', () => {
			tableNoSortKey.deleteById({
				primaryKey: 'pkvalue',
			});

			expect(mockClient.DeleteItemCommandMock.mock.lastCall![2]).toEqual({
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

			expect(mockClient.QueryItemsCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(QueryItemsCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			table.query('#pk = :pk', { pk: 'some-value' });

			expect(mockClient.QueryItemsCommandMock.mock.lastCall![0]).toBeInstanceOf(MockORMClient);
		});

		it('Should pass a Table instance to the Command', () => {
			table.query('#pk = :pk', { pk: 'some-value' });

			expect(mockClient.QueryItemsCommandMock.mock.lastCall![1]).toBeInstanceOf(Table);
			expect(mockClient.QueryItemsCommandMock.mock.lastCall![1]).toBe(table);
		});

		it('Should provide QueryItemsCommand with a valid condition expression', () => {
			table.query('#pk = :pk', { pk: 'some-value' });

			expect(mockClient.QueryItemsCommandMock.mock.lastCall![2]).toBe('#pk = :pk');
		});

		it('Should provide QueryItemsCommand with query values', () => {
			table.query('#pk = :pk AND begins_with(#sk, :sk)', { pk: 'some-value', sk: 'some-sk' });

			expect(mockClient.QueryItemsCommandMock.mock.lastCall![3]).toEqual({ pk: 'some-value', sk: 'some-sk' });
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

			expect(mockClient.UpdateItemCommandMock).toHaveBeenCalledOnce();
			expect(cmd).toBeInstanceOf(UpdateItemCommand);
		});

		it('Should pass a DbClient to the Command', () => {
			record.name = 'Gucio';
			table.update(record);

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![0]).toBeInstanceOf(MockORMClient);
		});

		it('Should pass a Table instance to the Command', () => {
			record.name = 'Gucio';
			table.update(record);

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![1]).toBeInstanceOf(Table);
			expect(mockClient.UpdateItemCommandMock.mock.lastCall![1]).toBe(table);
		});

		it('Should provide UpdateItemCommand with a valid composite record key', () => {
			record.name = 'Gucio';
			table.update(record);

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![2]).toEqual({
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

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![2]).toEqual({
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

		it('Should provide UpdateItemCommand with a valid update data', () => {
			record.name = 'Gucio';
			delete record.smth;

			table.update(record);

			const updated = record._updated;
			expect(mockClient.UpdateItemCommandMock.mock.lastCall![3]).toEqual({
				set: { name: 'Gucio', _updated: updated },
				remove: ['smth'],
			});
		});

		// it('Should provide UpdateItemCommand with a set of ExpressionAttributesNames', () => {
		// 	record.name = 'Gucio';
		// 	delete record.smth;

		// 	table.update(record);

		// 	expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeNames).toEqual({
		// 		'#name': 'name',
		// 		'#smth': 'smth',
		// 		'#_updated': '_updated',
		// 	});
		// });

		// it('Should provide UpdateItemCommand with a set of marshalled ExpressionAttributesValues', () => {
		// 	record.name = 'Gucio';
		// 	delete record.smth;
		// 	table.update(record);

		// 	const updatedIso = record._updated.toISOString();

		// 	expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeValues).toEqual({
		// 		':name': 'Gucio',
		// 		':_updated': updatedIso,
		// 	});
		// });
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

			expect(mockClient.UpdateItemCommandMock).toHaveBeenCalledOnce();
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

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![0]).toBeInstanceOf(MockORMClient);
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

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![1]).toBeInstanceOf(Table);
			expect(mockClient.UpdateItemCommandMock.mock.lastCall![1]).toBe(table);
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

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![2]).toEqual({
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

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![2]).toEqual({
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

		it('Should provide UpdateItemCommand with a valid UpdateData', () => {
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

			expect(mockClient.UpdateItemCommandMock.mock.lastCall![3]).toEqual({
				set: { name: 'Gucio', _updated: updated },
				remove: ['smth'],
			});
		});

		// it('Should provide UpdateItemCommand with a set of ExpressionAttributesNames', () => {
		// 	const updated = new Date();
		// 	table.updateById(
		// 		{
		// 			primaryKey: 'pk-value',
		// 			sortKey: 'sk-value',
		// 		},
		// 		{
		// 			set: { name: 'Gucio', _updated: updated },
		// 			remove: ['smth'],
		// 		},
		// 	);

		// 	expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeNames).toEqual({
		// 		'#name': 'name',
		// 		'#smth': 'smth',
		// 		'#_updated': '_updated',
		// 	});
		// });

		// it('Should provide UpdateItemCommand with a set of marshalled ExpressionAttributesValues', () => {
		// 	const updated = new Date();
		// 	table.updateById(
		// 		{
		// 			primaryKey: 'pk-value',
		// 			sortKey: 'sk-value',
		// 		},
		// 		{
		// 			set: { name: 'Gucio', _updated: updated },
		// 			remove: ['smth'],
		// 		},
		// 	);

		// 	expect(UpdateItemCommandMock.mock.lastCall![1].ExpressionAttributeValues).toEqual({
		// 		':name': 'Gucio',
		// 		':_updated': updated.toISOString(),
		// 	});
		// });
	});
});
