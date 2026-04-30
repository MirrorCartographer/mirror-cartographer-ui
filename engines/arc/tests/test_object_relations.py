from engines.arc.object_relations import describe_grid, extract_components, describe_relations


def test_extract_components_describes_shape_geometry_and_symmetry():
    grid = [
        [0, 0, 0, 0, 0],
        [0, 2, 2, 0, 3],
        [0, 2, 2, 0, 3],
        [0, 0, 0, 0, 0],
    ]

    components = extract_components(grid)

    assert len(components) == 2
    square = components[0]
    line = components[1]

    assert square.color == 2
    assert square.area == 4
    assert square.height == 2
    assert square.width == 2
    assert square.bbox.min_row == 1
    assert square.bbox.min_col == 1
    assert square.horizontal_symmetry is True
    assert square.vertical_symmetry is True
    assert square.touches_border is False

    assert line.color == 3
    assert line.area == 2
    assert line.height == 2
    assert line.width == 1
    assert line.touches_border is True


def test_relations_capture_same_area_alignment_adjacency_and_distance():
    grid = [
        [0, 0, 0, 0, 0],
        [0, 2, 2, 3, 3],
        [0, 2, 2, 3, 3],
        [0, 0, 0, 0, 0],
    ]

    components = extract_components(grid)
    relations = describe_relations(components)

    assert len(relations) == 1
    relation = relations[0]
    assert relation.same_color is False
    assert relation.same_area is True
    assert relation.aligned_row is True
    assert relation.aligned_col is False
    assert relation.bbox_adjacent is True
    assert relation.contains is False
    assert relation.contained_by is False
    assert relation.centroid_distance > 0


def test_describe_grid_returns_serializable_payload():
    grid = [
        [0, 1, 0],
        [2, 0, 2],
        [0, 1, 0],
    ]

    description = describe_grid(grid)

    assert description["shape"] == [3, 3]
    assert description["background"] == 0
    assert len(description["components"]) == 4
    assert isinstance(description["relations"], list)
    assert "bbox" in description["components"][0]
