import httpx

from app.services.nhtsa_specs import (
    fetch_vehicle_variables_for_make_model,
    get_make_model_catalog,
)


def test_get_make_model_catalog_uses_year_endpoint():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "Results": [
                    {
                        "Make_ID": 448,
                        "Make_Name": "TOYOTA",
                        "Model_ID": 2207,
                        "Model_Name": "Corolla",
                        "VehicleTypeName": "Passenger Car",
                    }
                ]
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        rows = get_make_model_catalog("Toyota", year=2020, client=client)

    assert requests
    assert requests[0].url.path.endswith("/GetModelsForMakeYear/make/Toyota/modelyear/2020")
    assert requests[0].url.params["format"] == "json"
    assert rows == [
        {
            "make": "TOYOTA",
            "model": "Corolla",
            "make_id": 448,
            "model_id": 2207,
            "source": "nhtsa_vpic",
            "vehicle_type": "Passenger Car",
        }
    ]


def test_fetch_vehicle_variables_for_make_model_filters_catalog_matches():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "Results": [
                    {"Make_Name": "TOYOTA", "Model_Name": "Camry", "Model_ID": 2109},
                    {"Make_Name": "TOYOTA", "Model_Name": "Corolla", "Model_ID": 2207},
                    {"Make_Name": "TOYOTA", "Model_Name": "Corolla Cross", "Model_ID": 27437},
                ]
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        rows = fetch_vehicle_variables_for_make_model("Toyota", "Corolla Axio", client=client)

    assert [row["model"] for row in rows] == ["Corolla"]


def test_fetch_vehicle_variables_for_make_model_fail_open():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"message": "temporarily unavailable"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        rows = fetch_vehicle_variables_for_make_model("Toyota", "Corolla", year=2020, client=client)

    assert rows == []
