import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    console.log(customerExists);

    if (!customerExists) {
      throw new AppError(
        'Não foi possível localizar este cliente com este Id.',
      );
    }

    const productsExists = await this.productsRepository.findAllById(products);

    if (!productsExists.length) {
      throw new AppError('Produtos inexistentes');
    }

    const existentProductsIds = productsExists.map(product => product.id);

    const checkInexistent = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkInexistent.length) {
      throw new AppError(`Produto ${checkInexistent[0].id} não encontrado`);
    }

    // return invalid products quantity
    const findProductsWithoutQuantity = products.filter(
      product =>
        productsExists.filter(prod => prod.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithoutQuantity.length) {
      throw new AppError(
        `A quantidade ${findProductsWithoutQuantity[0].quantity} não está disponível para o produto ${findProductsWithoutQuantity[0].id}`,
      );
    }

    const parsedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExists.filter(prod => prod.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: parsedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        productsExists.filter(prod => prod.id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
