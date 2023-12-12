const AppError = require("../utils/AppError");
const knex = require("../database/knex");

class Dishes {
  async create(request, response) {
    let { name, category, price, description, ingredients } = request.body;

    if (!name || !category) {
      throw new AppError("Tanto o nome quanto a categoria são obrigatórios");
    }

    ingredients = ingredients ?? [];

    const [dish_id] = await knex("dishes").insert({
      name,
      category,
      price,
      description,
    });

    if (ingredients.length > 0) {
      const ingredientsInsert = ingredients.map((ingredient) => ({
        name: ingredient.trim(),
        dish_id,
      }));

      await knex("ingredients").insert(ingredientsInsert);
    }

    return response.status(201).json();
  }

  async update(request, response) {
    let { name, category, price, description, ingredients } = request.body;
    const { id } = request.params;

    const dish = await knex("dishes").where({ id }).first();

    if (!dish) {
      throw new AppError("Prato não encontrado");
    }

    if (!name || !category) {
      throw new AppError("Tanto o nome quanto a categoria são obrigatórios");
    }

    dish.name = name ?? dish.name;
    dish.category = category ?? dish.category;
    dish.price = price ?? dish.price;
    dish.description = description ?? dish.description;
    const updated_at = knex.fn.now();

    await knex("dishes")
      .update({ ...dish, updated_at })
      .where({ id });

    ingredients = ingredients ?? [];

    if (ingredients.length > 0) {
      // TRAZENDO OS ingredientes antigos
      const oldIngredients = await knex("ingredients")
        .where({ dish_id: id })
        .then((data) => data.map((ingredients) => ingredients.name));

      // removendo os ingredients que não uso mais
      const remove = oldIngredients.filter(
        (ingredient) => !ingredients.includes(ingredient)
      );

      await knex("ingredients")
        .delete()
        .where({ dish_id: id })
        .whereIn("name", remove);

      // ELEMENTOS NOVOS PARA INSERIR
      const newIngredients = ingredients
        .filter((ingredient) => !oldIngredients.includes(ingredient))
        .map((ingredient) => ({
          name: ingredient.trim(),
          dish_id: id,
        }));

      await knex("ingredients").insert(newIngredients);
    } else {
      await knex("ingredients").delete().where({ dish_id: id });
    }
    return response.json();
  }

  async show(request, response) {
    const { id } = request.params;

    const dish = await knex("dishes").where({ id }).first();

    if (!dish) {
      throw new AppError("Prato não encontrado");
    }

    const dishIngredients = await knex("ingredients")
      .where({ dish_id: id })
      .orderBy("name");

    return response.json({ ...dish, dishIngredients });
  }

  async index(request, response) {
    const { title, ingredients } = request.query;

    let dishes;
    if (ingredients) {
      const filterIngredients = ingredients
        .split(",")
        .filter((item) => item.trim());

      dishes = await knex("ingredients")
        .select(["dishes.id", "dishes.name"])
        .whereLike("dishes.name", `%${title}%`)
        .whereIn("ingredients.name", filterIngredients)
        .innerJoin("dishes", "dishes.id", "ingredients.dish_id")
        .orderBy("dishes.name");
    } else {
      dishes = await knex("dishes")
        .whereLike("name", `%${title}%`)
        .orderBy("name");
    }

    const allIngredients = await knex("ingredients");

    const dishesWithIngredients = dishes.map((dish) => {
      const dishIngredients = allIngredients.filter(
        (ingredient) => ingredient.dish_id === dish.id
      );

      return {
        ...dish,
        ingredients: dishIngredients,
      };
    });

    return response.json(dishesWithIngredients);
  }

  async delete(request, response) {
    const { id } = request.params;

    await knex("dishes").delete().where({ id });
    return response.json();
  }
}

module.exports = Dishes;
