cmake_minimum_required(VERSION 3.20)

project(tacoma_telemetry_backend LANGUAGES CXX)

# Keep compiler behavior portable and fail configuration if C++17 is unavailable.
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(TACOMA_TSAN "Build backend targets with ThreadSanitizer" OFF)
if(TACOMA_TSAN)
    add_compile_options(-fsanitize=thread)
    add_link_options(-fsanitize=thread)
endif()

# GoogleTest is fetched at configure time so a clean checkout can build tests
# without requiring a pre-installed copy.
include(FetchContent)

FetchContent_Declare(
    googletest
    URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

# Use CMake's platform-aware thread target instead of hard-coding pthread flags.
find_package(Threads REQUIRED)

# Core simulator library. Headers are exposed publicly because consumers include
# the ITelemetrySource, frame, and simulator interfaces.
add_library(tacoma_backend
    src/core/TelemetryQueue.cpp
    src/sim/DriveProfile.cpp
    src/sim/TacomaSimulator.cpp
)

target_include_directories(tacoma_backend
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)
target_compile_features(tacoma_backend PUBLIC cxx_std_17)
target_link_libraries(tacoma_backend PUBLIC Threads::Threads)

# Small Phase 1 executable that prints frames to the terminal.
add_executable(tacoma_app src/app/main.cpp)
target_link_libraries(tacoma_app PRIVATE tacoma_backend)

enable_testing()

# Keep tests in one executable so GoogleTest can discover each case for CTest.
add_executable(tacoma_tests
    tests/DriveProfileTests.cpp
    tests/TelemetryFrameTests.cpp
    tests/TelemetryQueueTests.cpp
    tests/TacomaSimulatorTests.cpp
)
target_link_libraries(tacoma_tests PRIVATE tacoma_backend GTest::gtest_main)

include(GoogleTest)
gtest_discover_tests(tacoma_tests)
