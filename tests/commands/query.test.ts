import { vi, describe, it, beforeEach, expect } from 'vitest';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { QueryItemsCommand, QueryResult } from 'src/commands/query';
import { defineEntity } from 'src/entity';
import { defineTable } from 'src/table';

type Test = {
	id: string;
	name: string;
	orgId: string;
	smth?: string;
	email?: string;
	pk?: string;
	sk?: string;
};

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

describe('QueryItems Command', () => {
	let cmd: QueryItemsCommand;

	const created = new Date();
	const updated = new Date();

	const items = [
		{
			id: '12345',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		},
		{
			id: '67890',
			name: 'Gucio',
			orgId: 'ACME',
			email: 'gucio@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#67890',
			sk: 'EMAIL#gucio@acme.com',
		},
	];

	const input = {
		TableName: 'TestTable',
		KeyConditionExpression: '#pk = :pk',
		ExpressionAttributeNames: { '#pk': 'pk' },
		ExpressionAttributeValues: { ':pk': 'pk-value' },
	};

	let dbClient = {
		send: vi.fn(),
	}; // just for testing

	const table = defineTable(dbClient as any, {
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

	beforeEach(() => {
		dbClient.send.mockResolvedValue({
			Items: items,
		});
		dbClient.send.mockClear();

		cmd = new QueryItemsCommand(dbClient as never, input, table);
	});

	it('Should return instance of QueryItemsCommand on creation', () => {
		expect(cmd).toBeInstanceOf(QueryItemsCommand);
	});

	it('Should send QueryCommand to the dbClient', async () => {
		await cmd.send();
		expect(dbClient.send).toHaveBeenCalledTimes(1);
		expect(dbClient.send.mock.lastCall![0]).toBeInstanceOf(QueryCommand);
	});

	it('Should create QueryCommand with a proper input', async () => {
		await cmd.send();
		const getCmd = dbClient.send.mock.lastCall![0];

		expect(getCmd.input).toEqual(input);
	});

	it('Should send command and return QueryResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(QueryResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.items<Test>()).toEqual([
			{
				id: '12345',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'damian@acme.com',
				smth: 'something',
				_created: created,
				_updated: updated,
				_type: 'TEST',
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			},
			{
				id: '67890',
				name: 'Gucio',
				orgId: 'ACME',
				email: 'gucio@acme.com',
				smth: 'something',
				_created: created,
				_updated: updated,
				_type: 'TEST',
				pk: 'TEST#67890',
				sk: 'EMAIL#gucio@acme.com',
			},
		]);
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const records = res.items<Test>()!;

		expect(records[0].pk).toBe('TEST#12345');

		records[0].id = '0987';
		expect(records[0].pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		dbClient.send.mockResolvedValue({ Items: undefined });

		const res = await cmd.send();
		expect(res.items<Test>()).toEqual([]);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		dbClient.send.mockResolvedValue({
			Items: [
				{
					id: '12345',
					name: 'Gucio',
					orgId: 'ACME',
					email: 'damian@acme.com',
				},
			],
		});

		const res = await cmd.send();

		expect(() => {
			res.items<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual(items);
	});
});
