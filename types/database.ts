export type ShippingType = "free" | "paid";

export type ProductAvailability = "disponible" | "bajo_pedido" | "agotado";

export interface Product {
    id: string;
    categoria_id: string | null;
    nombre: string;
    slug: string;
    descripcion: string | null;
    caracteristicas: string[] | null;
    precio_usd: number;
    disponibilidad: ProductAvailability;
    garantia: string | null;
    transporte: string | null;
    imagen_principal: string | null;
    imagenes: string[] | null;
    destacado: boolean;
    activo: boolean;
    created_at: string;
    updated_at: string;
    shipping_type: ShippingType;
    shipping_cost: number | null;
    calificacion?: number | null;
    calificacion_count?: number | null;
}

export type ProductInput = Pick<
    Product,
    | "nombre"
    | "categoria_id"
    | "descripcion"
    | "caracteristicas"
    | "precio_usd"
    | "disponibilidad"
    | "garantia"
    | "transporte"
    | "imagen_principal"
    | "imagenes"
    | "activo"
    | "shipping_type"
    | "shipping_cost"
> & {
    slug?: string;
    updated_at?: string;
};

export type ProductUpdate = Partial<ProductInput>;

export type ProductShipping = Pick<Product, "shipping_type" | "shipping_cost">;

export interface Database {
    public: {
        Tables: {
            productos: {
                Row: Product;
                Insert: ProductInput;
                Update: ProductUpdate;
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}
